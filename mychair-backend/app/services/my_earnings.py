from __future__ import annotations

import calendar
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from beanie import PydanticObjectId

from app.core import tenant_context
from app.models.appointment import Appointment
from app.models.billing import Invoice, Payment
from app.models.payroll import Payroll
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.my_earnings import (
    BestEarningDay,
    BreakdownMetric,
    DailyEarningsRow,
    EarningsActivityItem,
    EarningsSummary,
    EarningsTrendPoint,
    IncentiveBreakdown,
    SalaryHistoryItem,
    SalaryHistoryResponse,
    WalletOverview,
    WalletTransaction,
)
from app.utils.timezone import now_utc


PAID_INVOICE_STATUSES = {"PAID", "PARTIALLY_PAID"}
COMPLETED_APPOINTMENT_STATUSES = {"COMPLETED"}


@dataclass
class _LineLedger:
    key: str
    date: datetime
    item_type: str
    item_name: str
    appointment_id: Optional[str]
    invoice_id: str
    invoice_number: str
    gross_amount: float
    net_amount: float
    incentive_amount: float
    refund_amount: float
    tax_amount: float


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Normalize a potentially naive datetime to UTC-aware."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class MyEarningsService:
    def _resolve_tenant_id(self, actor: User) -> str:
        """Return the tenant/org ID for the given user (used for DB tenant isolation)."""
        return tenant_context.get_tenant_id() or str(actor.tenant_id or "")

    def _resolve_salon_id(self, actor: User) -> str:
        """Return the salon/branch ID for the given user. Falls back to tenant_id if branch_id is not set."""
        return str(actor.branch_id or "").strip() or self._resolve_tenant_id(actor)

    @staticmethod
    def _safe_round(value: float) -> float:
        return round(value, 2)

    @staticmethod
    def _line_total(unit_price: float, quantity: int, discount: float) -> float:
        return round(max((unit_price * quantity) - discount, 0.0), 2)

    @staticmethod
    def _line_tax(subtotal: float, tax_rate: float) -> float:
        return round(max(subtotal, 0.0) * max(tax_rate, 0.0) / 100.0, 2)

    @staticmethod
    def _day_range(day: datetime) -> Tuple[datetime, datetime]:
        start = day.replace(hour=0, minute=0, second=0, microsecond=0)
        return start, start + timedelta(days=1)

    @staticmethod
    def _month_range(month: int, year: int) -> Tuple[datetime, datetime]:
        start = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        return start, end

    @staticmethod
    def _shift_month(month: int, year: int, delta: int) -> Tuple[int, int]:
        absolute = (year * 12 + (month - 1)) + delta
        shifted_year = absolute // 12
        shifted_month = (absolute % 12) + 1
        return shifted_month, shifted_year

    @staticmethod
    def _week_range(day: datetime) -> Tuple[datetime, datetime]:
        start = day.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(
            days=day.weekday()
        )
        return start, start + timedelta(days=7)

    @staticmethod
    def _parse_iso_date(value: Optional[str]) -> Optional[datetime]:
        if not value:
            return None
        parsed = datetime.fromisoformat(value)
        return parsed.replace(tzinfo=timezone.utc) if parsed.tzinfo is None else parsed.astimezone(timezone.utc)

    def _resolve_range(
        self,
        today: datetime,
        month: Optional[int],
        year: Optional[int],
        period: Optional[str],
        start_date: Optional[str],
        end_date: Optional[str],
    ) -> Tuple[datetime, datetime, int, int, str]:
        normalized_period = (period or "monthly").strip().lower()
        active_month = month or today.month
        active_year = year or today.year

        if normalized_period == "daily":
            start, end = self._day_range(today)
            return start, end, start.month, start.year, "daily"

        if normalized_period == "weekly":
            start, end = self._week_range(today)
            return start, end, start.month, start.year, "weekly"

        if normalized_period == "yearly":
            start = datetime(active_year, 1, 1, tzinfo=timezone.utc)
            end = datetime(active_year + 1, 1, 1, tzinfo=timezone.utc)
            return start, end, active_month, active_year, "yearly"

        if normalized_period == "custom":
            start = self._parse_iso_date(start_date)
            end = self._parse_iso_date(end_date)
            if not start and not end:
                start, end = self._month_range(active_month, active_year)
            else:
                if not start:
                    start = end
                if not end:
                    end = start
                start = start.replace(hour=0, minute=0, second=0, microsecond=0)
                end = end.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
                if start > end:
                    start, end = end - timedelta(days=1), start + timedelta(days=1)
            return start, end, start.month, start.year, "custom"

        start, end = self._month_range(active_month, active_year)
        return start, end, active_month, active_year, "monthly"

    @staticmethod
    def _elapsed_days(start: datetime, end: datetime, today: datetime) -> Tuple[int, int]:
        total_days = max((end - start).days, 1)
        effective_end = min(end, today + timedelta(days=1))
        elapsed = max((effective_end - start).days, 0)
        return min(elapsed, total_days), total_days

    def _salary_for_range(self, actor: User, start: datetime, end: datetime, today: datetime) -> float:
        salary = float(actor.salary or 0.0)
        salary_type = (actor.salary_type or "monthly").lower()
        elapsed_days, _ = self._elapsed_days(start, end, today)
        if elapsed_days <= 0:
            return 0.0
        if salary_type == "daily":
            return self._safe_round(salary * elapsed_days)
        if salary_type == "weekly":
            return self._safe_round((salary / 7.0) * elapsed_days)
        month_days = calendar.monthrange(start.year, start.month)[1]
        return self._safe_round((salary / max(month_days, 1)) * elapsed_days)

    async def _payment_map(self, invoice_ids: List[str]) -> Dict[str, List[Payment]]:
        if not invoice_ids:
            return {}
        payments = await Payment.find(
            {"invoice_id": {"$in": invoice_ids}, "is_deleted": False}
        ).sort("+payment_date").to_list()
        grouped: Dict[str, List[Payment]] = {}
        for payment in payments:
            grouped.setdefault(payment.invoice_id, []).append(payment)
        return grouped

    def _refund_ratio(self, invoice: Invoice, payments: List[Payment]) -> float:
        refunded_total = sum(max(payment.refunded_amount, 0.0) for payment in payments)
        if invoice.total_amount <= 0:
            return 0.0
        return min(max(refunded_total / invoice.total_amount, 0.0), 1.0)

    async def _appointment_map(self, appointment_ids: List[str]) -> Dict[str, Appointment]:
        object_ids = []
        for appointment_id in appointment_ids:
            try:
                object_ids.append(PydanticObjectId(appointment_id))
            except Exception:
                continue
        if not object_ids:
            return {}
        appointments = await Appointment.find(
            {"_id": {"$in": object_ids}, "is_deleted": False}
        ).to_list()
        return {str(appointment.id): appointment for appointment in appointments}

    def _eligible_for_incentive(
        self, invoice: Invoice, appointment: Optional[Appointment]
    ) -> bool:
        if invoice.status == "VOIDED":
            return False
        if appointment and appointment.status == "CANCELLED":
            return False
        if appointment and appointment.status in COMPLETED_APPOINTMENT_STATUSES:
            return True
        return (invoice.payment_status or "").upper() in PAID_INVOICE_STATUSES

    async def _load_ledgers(
        self, actor: User, start: datetime, end: datetime
    ) -> List[_LineLedger]:
        tenant_id = self._resolve_tenant_id(actor)
        salon_id = str(actor.branch_id or "").strip() if actor.branch_id else None

        query: Dict = {
            "tenant_id": tenant_id,
            "is_deleted": False,
            "created_at": {"$gte": start, "$lt": end},
            "items.staff_id": str(actor.id),
        }
        # Filter by specific salon/branch if the staff is assigned to one
        if salon_id:
            query["salon_id"] = salon_id

        invoices = await Invoice.find(query).sort("+created_at").to_list()
        if not invoices:
            return []

        payment_map = await self._payment_map([str(invoice.id) for invoice in invoices])
        appointment_map = await self._appointment_map(
            [invoice.appointment_id for invoice in invoices if invoice.appointment_id]
        )

        ledgers: List[_LineLedger] = []
        service_pct = (actor.service_incentive_percent or 0.0) / 100.0
        product_pct = (actor.product_incentive_percent or 0.0) / 100.0
        incentives_enabled = bool(actor.incentive_base)

        for invoice in invoices:
            appointment = appointment_map.get(invoice.appointment_id or "")
            if not self._eligible_for_incentive(invoice, appointment):
                continue

            refund_ratio = self._refund_ratio(invoice, payment_map.get(str(invoice.id), []))
            raw_date = invoice.finalized_at or invoice.created_at
            ledger_date = _ensure_utc(raw_date) or start
            for index, item in enumerate(invoice.items):
                if item.staff_id != str(actor.id):
                    continue
                gross_subtotal = self._line_total(item.unit_price, item.quantity, item.discount)
                gross_tax = self._line_tax(gross_subtotal, item.tax_rate)
                gross = round(gross_subtotal + gross_tax, 2)
                refund_amount = round(gross * refund_ratio, 2)
                net = round(max(gross - refund_amount, 0.0), 2)
                pct = service_pct if item.item_type == "SERVICE" else product_pct
                incentive = round(net * pct, 2) if incentives_enabled else 0.0
                ledgers.append(
                    _LineLedger(
                        key=f"{invoice.id}:{index}",
                        date=ledger_date,
                        item_type=item.item_type,
                        item_name=item.name,
                        appointment_id=invoice.appointment_id,
                        invoice_id=str(invoice.id),
                        invoice_number=invoice.invoice_number,
                        gross_amount=gross,
                        net_amount=net,
                        incentive_amount=incentive,
                        refund_amount=refund_amount,
                        tax_amount=gross_tax,
                    )
                )
        return ledgers

    def _group_daily(self, ledgers: List[_LineLedger]) -> List[DailyEarningsRow]:
        grouped: Dict[str, DailyEarningsRow] = {}
        for entry in ledgers:
            key = entry.date.strftime("%Y-%m-%d")
            if key not in grouped:
                grouped[key] = DailyEarningsRow(date=entry.date)
            row = grouped[key]
            if entry.item_type == "SERVICE":
                row.service_earnings += entry.net_amount
                row.service_incentive += entry.incentive_amount
            else:
                row.product_earnings += entry.net_amount
                row.product_incentive += entry.incentive_amount
            row.total_earnings += entry.net_amount + entry.incentive_amount
            row.total_incentives += entry.incentive_amount
            if entry.appointment_id and entry.appointment_id not in row.appointment_references:
                row.appointment_references.append(entry.appointment_id)

        rows = list(grouped.values())
        rows.sort(key=lambda row: row.date, reverse=True)
        for row in rows:
            row.service_earnings = self._safe_round(row.service_earnings)
            row.product_earnings = self._safe_round(row.product_earnings)
            row.service_incentive = self._safe_round(row.service_incentive)
            row.product_incentive = self._safe_round(row.product_incentive)
            row.total_earnings = self._safe_round(row.total_earnings)
            row.total_incentives = self._safe_round(row.total_incentives)
        return rows

    async def get_summary(
        self,
        actor: User,
        month: Optional[int] = None,
        year: Optional[int] = None,
        period: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> EarningsSummary:
        today = now_utc()
        start, end, active_month, active_year, range_label = self._resolve_range(
            today, month, year, period, start_date, end_date
        )
        ledgers = await self._load_ledgers(actor, start, end)
        today_start, today_end = self._day_range(today)

        month_service = sum(
            entry.incentive_amount for entry in ledgers if entry.item_type == "SERVICE"
        )
        month_product = sum(
            entry.incentive_amount for entry in ledgers if entry.item_type == "PRODUCT"
        )
        today_service = sum(
            entry.incentive_amount
            for entry in ledgers
            if entry.item_type == "SERVICE" and today_start <= entry.date < today_end
        )
        today_product = sum(
            entry.incentive_amount
            for entry in ledgers
            if entry.item_type == "PRODUCT" and today_start <= entry.date < today_end
        )
        today_incentives = today_service + today_product
        today_earnings = sum(
            entry.net_amount + entry.incentive_amount
            for entry in ledgers
            if today_start <= entry.date < today_end
        )
        period_incentives = self._safe_round(month_service + month_product)
        base_to_date = self._salary_for_range(actor, start, end, today)
        period_total = self._safe_round(
            base_to_date + sum(entry.net_amount for entry in ledgers) + period_incentives
        )

        payroll = await Payroll.find_one(
            {
                "tenant_id": self._resolve_tenant_id(actor),
                "employee_id": str(actor.id),
                "month": active_month,
                "year": active_year,
                "is_deleted": False,
            }
        )
        paid_amount = (
            float(payroll.final_paid_amount or payroll.final_salary or 0.0)
            if payroll and payroll.payment_status == "PAID"
            else 0.0
        )
        pending_payout = self._safe_round(max(period_total - paid_amount, 0.0))

        elapsed_days, total_days = self._elapsed_days(start, end, today)
        projected = period_total
        if elapsed_days > 0:
            projected = self._safe_round((period_total / elapsed_days) * total_days)

        prorated_target = self._salary_for_range(actor, start, end, end - timedelta(seconds=1))
        full_target = prorated_target + period_incentives
        target_progress = (
            self._safe_round((period_total / full_target) * 100.0) if full_target > 0 else 0.0
        )
        unique_appointments = {entry.appointment_id for entry in ledgers if entry.appointment_id}
        daily_average = self._safe_round(period_total / max(elapsed_days, 1)) if elapsed_days else 0.0

        return EarningsSummary(
            month=active_month,
            year=active_year,
            range_label=range_label,
            base_salary_to_date=base_to_date,
            today_earnings=self._safe_round(today_earnings),
            today_incentives=self._safe_round(today_incentives),
            service_incentive_today=self._safe_round(today_service),
            product_incentive_today=self._safe_round(today_product),
            month_earnings_to_date=period_total,
            month_incentives_to_date=period_incentives,
            pending_payout=pending_payout,
            estimated_month_end_earnings=projected,
            wallet_balance=period_incentives,
            total_service_incentive=self._safe_round(month_service),
            total_product_incentive=self._safe_round(month_product),
            daily_average_earnings=daily_average,
            completed_appointments_count=len(unique_appointments),
            incentive_entries_count=len(ledgers),
            month_progress_percent=self._safe_round((elapsed_days / total_days) * 100.0),
            target_progress_percent=min(target_progress, 100.0),
        )

    async def list_daily_earnings(
        self,
        actor: User,
        month: Optional[int] = None,
        year: Optional[int] = None,
        period: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> List[DailyEarningsRow]:
        today = now_utc()
        start, end, _, _, _ = self._resolve_range(today, month, year, period, start_date, end_date)
        ledgers = await self._load_ledgers(actor, start, end)
        return self._group_daily(ledgers)

    async def list_recent_activity(
        self,
        actor: User,
        month: Optional[int] = None,
        year: Optional[int] = None,
        period: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        limit: int = 12,
    ) -> List[EarningsActivityItem]:
        today = now_utc()
        start, end, _, _, _ = self._resolve_range(today, month, year, period, start_date, end_date)
        ledgers = await self._load_ledgers(actor, start, end)
        rows = sorted(ledgers, key=lambda item: item.date, reverse=True)[:limit]
        return [
            EarningsActivityItem(
                id=row.key,
                date=row.date,
                item_type=row.item_type,
                item_name=row.item_name,
                reference_label=row.invoice_number,
                appointment_id=row.appointment_id,
                gross_amount=self._safe_round(row.gross_amount),
                net_amount=self._safe_round(row.net_amount),
                incentive_amount=self._safe_round(row.incentive_amount),
                refund_amount=self._safe_round(row.refund_amount),
                note=(
                    "Refund adjusted automatically"
                    if row.refund_amount > 0
                    else "Added after completed billing"
                ),
            )
            for row in rows
        ]

    async def get_wallet(
        self,
        actor: User,
        month: Optional[int] = None,
        year: Optional[int] = None,
        period: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> WalletOverview:
        today = now_utc()
        start, end, _, _, _ = self._resolve_range(today, month, year, period, start_date, end_date)
        ledgers = await self._load_ledgers(actor, start, end)
        transactions: List[WalletTransaction] = []
        running_balance = 0.0

        for entry in sorted(ledgers, key=lambda item: item.date):
            running_balance += entry.incentive_amount
            transactions.append(
                WalletTransaction(
                    id=entry.key,
                    date=entry.date,
                    transaction_type="EARNED",
                    category="SERVICE_INCENTIVE"
                    if entry.item_type == "SERVICE"
                    else "PRODUCT_INCENTIVE",
                    amount=self._safe_round(entry.incentive_amount),
                    running_balance=self._safe_round(running_balance),
                    reference_id=entry.invoice_id,
                    reference_label=entry.invoice_number,
                    appointment_id=entry.appointment_id,
                    item_name=entry.item_name,
                    note=(
                        "Refund adjusted automatically"
                        if entry.refund_amount > 0
                        else "Auto-calculated from eligible billing"
                    ),
                )
            )

        payrolls = await Payroll.find(
            {
                "tenant_id": self._resolve_tenant_id(actor),
                "employee_id": str(actor.id),
                "payment_status": "PAID",
                "is_deleted": False,
            }
        ).sort("+year", "+month").to_list()

        paid_out_total = 0.0
        for payroll in payrolls:
            payout = float(payroll.service_incentive or 0.0) + float(payroll.product_incentive or 0.0)
            if payout <= 0:
                continue
            paid_out_total += payout
            running_balance -= payout
            payment_date = payroll.payment_date or payroll.generated_at or now_utc()
            transactions.append(
                WalletTransaction(
                    id=f"payroll:{payroll.id}",
                    date=payment_date,
                    transaction_type="PAYOUT",
                    category="INCENTIVE_PAYOUT",
                    amount=self._safe_round(-payout),
                    running_balance=self._safe_round(running_balance),
                    reference_id=str(payroll.id),
                    reference_label=f"Payroll {payroll.month:02d}/{payroll.year}",
                    note="Settled through salary payout",
                )
            )

        transactions.sort(key=lambda item: item.date, reverse=True)
        earned_total = self._safe_round(sum(max(item.amount, 0.0) for item in transactions))
        return WalletOverview(
            balance=self._safe_round(earned_total - paid_out_total),
            earned_total=earned_total,
            paid_out_total=self._safe_round(paid_out_total),
            transactions=transactions,
        )

    async def list_salary_history(
        self, actor: User, page: int = 1, limit: int = 12
    ) -> SalaryHistoryResponse:
        query = {
            "tenant_id": self._resolve_tenant_id(actor),
            "employee_id": str(actor.id),
            "is_deleted": False,
        }
        total = await Payroll.find(query).count()
        skip = (page - 1) * limit
        payrolls = (
            await Payroll.find(query)
            .sort("-year", "-month")
            .skip(skip)
            .limit(limit)
            .to_list()
        )

        items: List[SalaryHistoryItem] = []
        for payroll in payrolls:
            total_earnings = float(
                payroll.base_salary
                + payroll.service_incentive
                + payroll.product_incentive
                + payroll.bonus
                - payroll.deduction
            )
            final_paid_amount = (
                float(payroll.final_paid_amount or payroll.final_salary or 0.0)
                if payroll.payment_status == "PAID"
                else 0.0
            )
            pending_amount = 0.0 if payroll.payment_status == "PAID" else total_earnings
            items.append(
                SalaryHistoryItem(
                    id=str(payroll.id),
                    month=payroll.month,
                    year=payroll.year,
                    salary_type=payroll.salary_type,
                    base_salary=self._safe_round(payroll.base_salary),
                    service_incentive=self._safe_round(payroll.service_incentive),
                    product_incentive=self._safe_round(payroll.product_incentive),
                    bonus=self._safe_round(payroll.bonus),
                    deduction=self._safe_round(payroll.deduction),
                    total_earnings=self._safe_round(total_earnings),
                    paid_amount=self._safe_round(final_paid_amount),
                    pending_amount=self._safe_round(pending_amount),
                    final_paid_amount=self._safe_round(final_paid_amount),
                    payment_status=payroll.payment_status,
                    payment_date=payroll.payment_date,
                    generated_at=payroll.generated_at,
                )
            )

        pages = max(1, (total + limit - 1) // limit) if total > 0 else 1
        return SalaryHistoryResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )

    async def get_salary_slip(self, actor: User, payroll_id: str) -> Dict[str, object]:
        payroll = await Payroll.find_one(
            {
                "_id": PydanticObjectId(payroll_id),
                "tenant_id": self._resolve_tenant_id(actor),
                "employee_id": str(actor.id),
                "is_deleted": False,
            }
        )
        if not payroll:
            raise ValueError("Salary slip not found")

        tenant = None
        if payroll.tenant_id:
            try:
                tenant = await Tenant.get(PydanticObjectId(payroll.tenant_id))
            except Exception:
                tenant = None
        return {
            "id": str(payroll.id),
            "employee_id": payroll.employee_id,
            "employee_name": payroll.employee_name,
            "employee_role": payroll.employee_role,
            "month": payroll.month,
            "year": payroll.year,
            "salary_type": payroll.salary_type,
            "base_salary": payroll.base_salary,
            "service_incentive_percent": payroll.service_incentive_percent,
            "product_incentive_percent": payroll.product_incentive_percent,
            "service_sales_total": payroll.service_sales_total,
            "product_sales_total": payroll.product_sales_total,
            "service_incentive": payroll.service_incentive,
            "product_incentive": payroll.product_incentive,
            "bonus": payroll.bonus,
            "deduction": payroll.deduction,
            "final_salary": payroll.final_salary,
            "final_paid_amount": payroll.final_paid_amount,
            "payment_status": payroll.payment_status,
            "payment_date": payroll.payment_date.isoformat() if payroll.payment_date else None,
            "generated_at": payroll.generated_at.isoformat() if payroll.generated_at else None,
            "salon_id": payroll.salon_id,
            "salon_name": tenant.name if tenant else None,
        }

    async def get_incentive_breakdown(
        self,
        actor: User,
        month: Optional[int] = None,
        year: Optional[int] = None,
        period: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> IncentiveBreakdown:
        today = now_utc()
        start, end, active_month, active_year, range_label = self._resolve_range(
            today, month, year, period, start_date, end_date
        )
        ledgers = await self._load_ledgers(actor, start, end)

        service_map: Dict[str, BreakdownMetric] = {}
        product_map: Dict[str, BreakdownMetric] = {}
        service_total = 0.0
        product_total = 0.0

        for entry in ledgers:
            bucket = service_map if entry.item_type == "SERVICE" else product_map
            metric = bucket.setdefault(entry.item_name, BreakdownMetric(name=entry.item_name))
            metric.earnings += entry.net_amount
            metric.incentive += entry.incentive_amount
            metric.count += 1
            if entry.item_type == "SERVICE":
                service_total += entry.incentive_amount
            else:
                product_total += entry.incentive_amount

        top_services = sorted(
            service_map.values(), key=lambda item: (item.incentive, item.earnings), reverse=True
        )[:5]
        top_products = sorted(
            product_map.values(), key=lambda item: (item.incentive, item.earnings), reverse=True
        )[:5]
        for metric in top_services + top_products:
            metric.earnings = self._safe_round(metric.earnings)
            metric.incentive = self._safe_round(metric.incentive)

        best_earning_days = []
        for row in self._group_daily(ledgers)[:]:
            best_earning_days.append(
                BestEarningDay(
                    date=row.date,
                    total_earnings=row.total_earnings,
                    total_incentives=row.total_incentives,
                    service_earnings=row.service_earnings,
                    product_earnings=row.product_earnings,
                )
            )
        best_earning_days.sort(key=lambda item: (item.total_earnings, item.total_incentives), reverse=True)
        best_earning_days = best_earning_days[:5]

        monthly_growth: List[EarningsTrendPoint] = []
        for offset in range(5, -1, -1):
            growth_month, growth_year = self._shift_month(active_month, active_year, -offset)
            month_start, month_end = self._month_range(growth_month, growth_year)
            month_ledgers = await self._load_ledgers(actor, month_start, month_end)
            service_incentive = sum(
                row.incentive_amount for row in month_ledgers if row.item_type == "SERVICE"
            )
            product_incentive = sum(
                row.incentive_amount for row in month_ledgers if row.item_type == "PRODUCT"
            )
            total_incentive = service_incentive + product_incentive
            total_earnings = sum(row.net_amount + row.incentive_amount for row in month_ledgers)
            monthly_growth.append(
                EarningsTrendPoint(
                    label=f"{calendar.month_abbr[month_start.month]} {str(month_start.year)[-2:]}",
                    earnings=self._safe_round(total_earnings),
                    incentives=self._safe_round(total_incentive),
                    service_incentive=self._safe_round(service_incentive),
                    product_incentive=self._safe_round(product_incentive),
                )
            )

        return IncentiveBreakdown(
            month=active_month,
            year=active_year,
            range_label=range_label,
            service_incentive_total=self._safe_round(service_total),
            product_incentive_total=self._safe_round(product_total),
            top_services=top_services,
            top_products=top_products,
            best_earning_days=best_earning_days,
            monthly_growth=monthly_growth,
        )
