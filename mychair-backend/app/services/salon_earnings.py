from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Set, Tuple

from beanie import PydanticObjectId

from app.core import tenant_context
from app.models.appointment import Appointment
from app.models.billing import Invoice, Payment
from app.models.inventory import ProductInventory
from app.models.user import User
from app.schemas.salon_earnings import (
    EarningsTrendPoint,
    FilterOption,
    PeriodComparison,
    ProductEarningsRow,
    RevenueSource,
    SalonEarningsFilterOptions,
    SalonEarningsReport,
    SalonEarningsSummary,
    SalonTransactionRow,
    SalonTransactionsResponse,
    ServiceEarningsRow,
    StaffPerformanceRow,
)
from app.utils.timezone import now_utc


PAID_INVOICE_STATUSES = {"PAID", "PARTIALLY_PAID"}
COMPLETED_APPOINTMENT_STATUSES = {"COMPLETED"}


@dataclass
class _StaffIncentiveConfig:
    incentive_base: bool = False
    service_pct: float = 0.0
    product_pct: float = 0.0


@dataclass
class _LineAgg:
    item_type: str
    item_id: str
    item_name: str
    quantity: int = 0
    gross: float = 0.0
    discounts: float = 0.0
    refunds: float = 0.0
    net: float = 0.0
    incentive: float = 0.0
    buying_price_unit: Optional[float] = None
    product_cost: float = 0.0
    has_product_cost: bool = False
    staff_names: Set[str] = field(default_factory=set)
    times: int = 0


@dataclass
class _StaffAgg:
    staff_id: str
    staff_name: str
    services_performed: int = 0
    service_revenue: float = 0.0
    product_sales: float = 0.0
    incentive: float = 0.0


@dataclass
class _DayAgg:
    total_revenue: float = 0.0
    service_revenue: float = 0.0
    product_revenue: float = 0.0
    incentives: float = 0.0
    product_cost: float = 0.0


@dataclass
class _InvoiceAgg:
    invoice: Invoice
    date: datetime
    refund_amount: float
    refund_ratio: float
    service_names: List[str] = field(default_factory=list)
    product_names: List[str] = field(default_factory=list)
    staff_names: Set[str] = field(default_factory=set)
    line_gross: float = 0.0
    line_discount: float = 0.0
    line_tax: float = 0.0
    line_net: float = 0.0
    incentives: float = 0.0


@dataclass
class _PeriodBundle:
    summary: SalonEarningsSummary
    revenue_sources: List[RevenueSource]
    trend: List[EarningsTrendPoint]
    services: List[ServiceEarningsRow]
    products: List[ProductEarningsRow]
    staff_performance: List[StaffPerformanceRow]
    filter_options: SalonEarningsFilterOptions
    invoice_aggs: List[_InvoiceAgg]


def _ensure_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


class SalonEarningsService:
    """Salon-wide financial overview for salon owners (not personal staff earnings)."""

    @staticmethod
    def _safe_round(value: float) -> float:
        return round(value, 2)

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
        return (
            parsed.replace(tzinfo=timezone.utc)
            if parsed.tzinfo is None
            else parsed.astimezone(timezone.utc)
        )

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

    def _previous_range(
        self, start: datetime, end: datetime, range_label: str
    ) -> Tuple[datetime, datetime]:
        duration = end - start
        if range_label == "monthly":
            prev_end = start
            if start.month == 1:
                prev_start = datetime(start.year - 1, 12, 1, tzinfo=timezone.utc)
            else:
                prev_start = datetime(start.year, start.month - 1, 1, tzinfo=timezone.utc)
            return prev_start, prev_end
        return start - duration, start

    def _resolve_tenant_id(self, actor: User) -> str:
        return tenant_context.get_tenant_id() or str(actor.tenant_id or "")

    def _resolve_salon_id(self, actor: User) -> Optional[str]:
        salon_id = str(actor.branch_id or "").strip()
        return salon_id or None

    async def _payment_map(self, invoice_ids: List[str]) -> Dict[str, List[Payment]]:
        if not invoice_ids:
            return {}
        payments = await Payment.find(
            {"invoice_id": {"$in": invoice_ids}, "is_deleted": False}
        ).to_list()
        grouped: Dict[str, List[Payment]] = {}
        for payment in payments:
            grouped.setdefault(payment.invoice_id, []).append(payment)
        return grouped

    def _refund_total(self, payments: List[Payment]) -> float:
        return self._safe_round(sum(max(payment.refunded_amount, 0.0) for payment in payments))

    def _refund_ratio(self, invoice: Invoice, payments: List[Payment]) -> float:
        refunded_total = self._refund_total(payments)
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

    def _eligible_invoice(self, invoice: Invoice, appointment: Optional[Appointment]) -> bool:
        if invoice.status == "VOIDED":
            return False
        if appointment and appointment.status == "CANCELLED":
            return False
        return True

    def _eligible_for_incentive(
        self, invoice: Invoice, appointment: Optional[Appointment]
    ) -> bool:
        if not self._eligible_invoice(invoice, appointment):
            return False
        if appointment and appointment.status in COMPLETED_APPOINTMENT_STATUSES:
            return True
        return (invoice.payment_status or "").upper() in PAID_INVOICE_STATUSES

    async def _load_staff_configs(self, tenant_id: str) -> Dict[str, _StaffIncentiveConfig]:
        users = await User.find({"tenant_id": tenant_id, "is_deleted": False}).to_list()
        configs: Dict[str, _StaffIncentiveConfig] = {}
        for user in users:
            configs[str(user.id)] = _StaffIncentiveConfig(
                incentive_base=bool(user.incentive_base),
                service_pct=(user.service_incentive_percent or 0.0) / 100.0,
                product_pct=(user.product_incentive_percent or 0.0) / 100.0,
            )
        return configs

    async def _load_product_costs(
        self, tenant_id: str, salon_id: Optional[str], product_ids: Set[str]
    ) -> Dict[str, float]:
        if not product_ids:
            return {}
        query: Dict = {
            "tenant_id": tenant_id,
            "product_id": {"$in": list(product_ids)},
            "is_deleted": False,
        }
        if salon_id:
            query["salon_id"] = salon_id
        inventories = await ProductInventory.find(query).to_list()
        costs: Dict[str, float] = {}
        for inv in inventories:
            price = float(inv.buying_price or 0.0)
            if price > 0 and inv.product_id not in costs:
                costs[inv.product_id] = price
        return costs

    async def _load_invoices(
        self, actor: User, start: datetime, end: datetime
    ) -> List[Invoice]:
        tenant_id = self._resolve_tenant_id(actor)
        query: Dict = {
            "tenant_id": tenant_id,
            "is_deleted": False,
            "created_at": {"$gte": start, "$lt": end},
        }
        salon_id = self._resolve_salon_id(actor)
        if salon_id:
            query["salon_id"] = salon_id
        return await Invoice.find(query).sort("+created_at").to_list()

    def _passes_filters(
        self,
        invoice: Invoice,
        staff_id: Optional[str],
        service_id: Optional[str],
        product_id: Optional[str],
        payment_method: Optional[str],
        revenue_type: Optional[str],
    ) -> bool:
        items = invoice.items or []
        if staff_id and not any(item.staff_id == staff_id for item in items):
            return False
        if service_id and not any(
            item.item_type == "SERVICE" and item.item_id == service_id for item in items
        ):
            return False
        if product_id and not any(
            item.item_type == "PRODUCT" and item.item_id == product_id for item in items
        ):
            return False
        if payment_method:
            method = (invoice.payment_method or "").upper()
            if method != payment_method.upper():
                return False
        if revenue_type:
            normalized = revenue_type.strip().upper()
            if normalized == "SERVICE" and not any(i.item_type == "SERVICE" for i in items):
                return False
            if normalized == "PRODUCT" and not any(i.item_type == "PRODUCT" for i in items):
                return False
        return True

    def _item_matches_filters(
        self,
        item,
        staff_id: Optional[str],
        service_id: Optional[str],
        product_id: Optional[str],
        revenue_type: Optional[str],
    ) -> bool:
        if staff_id and item.staff_id != staff_id:
            return False
        if revenue_type:
            normalized = revenue_type.strip().upper()
            if normalized in {"SERVICE", "PRODUCT"} and item.item_type != normalized:
                return False
        if service_id and not (item.item_type == "SERVICE" and item.item_id == service_id):
            return False
        if product_id and not (item.item_type == "PRODUCT" and item.item_id == product_id):
            return False
        return True

    def _build_trend(
        self, start: datetime, end: datetime, day_aggs: Dict[str, _DayAgg]
    ) -> List[EarningsTrendPoint]:
        day_count = max((end - start).days, 1)
        sorted_days = sorted(day_aggs.keys())
        trend: List[EarningsTrendPoint] = []

        if day_count <= 45:
            for day_key in sorted_days:
                day = day_aggs[day_key]
                trend.append(
                    EarningsTrendPoint(
                        label=datetime.strptime(day_key, "%Y-%m-%d").strftime("%d/%m"),
                        date=datetime.strptime(day_key, "%Y-%m-%d").replace(tzinfo=timezone.utc),
                        total_revenue=self._safe_round(day.total_revenue),
                        service_revenue=self._safe_round(day.service_revenue),
                        product_revenue=self._safe_round(day.product_revenue),
                        net_salon_earnings=self._safe_round(
                            day.total_revenue - day.product_cost - day.incentives
                        ),
                    )
                )
            return trend

        week_buckets: Dict[str, _DayAgg] = {}
        week_labels: Dict[str, str] = {}
        for day_key in sorted_days:
            day_dt = datetime.strptime(day_key, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            week_start = day_dt - timedelta(days=day_dt.weekday())
            week_key = week_start.strftime("%Y-%m-%d")
            if week_key not in week_buckets:
                week_buckets[week_key] = _DayAgg()
                week_labels[week_key] = f"W/c {week_start.strftime('%d/%m')}"
            src = day_aggs[day_key]
            bucket = week_buckets[week_key]
            bucket.total_revenue += src.total_revenue
            bucket.service_revenue += src.service_revenue
            bucket.product_revenue += src.product_revenue
            bucket.incentives += src.incentives
            bucket.product_cost += src.product_cost
        for week_key in sorted(week_buckets.keys()):
            bucket = week_buckets[week_key]
            trend.append(
                EarningsTrendPoint(
                    label=week_labels[week_key],
                    date=datetime.strptime(week_key, "%Y-%m-%d").replace(tzinfo=timezone.utc),
                    total_revenue=self._safe_round(bucket.total_revenue),
                    service_revenue=self._safe_round(bucket.service_revenue),
                    product_revenue=self._safe_round(bucket.product_revenue),
                    net_salon_earnings=self._safe_round(
                        bucket.total_revenue - bucket.product_cost - bucket.incentives
                    ),
                )
            )
        return trend

    async def _aggregate_period(
        self,
        actor: User,
        start: datetime,
        end: datetime,
        staff_id: Optional[str] = None,
        service_id: Optional[str] = None,
        product_id: Optional[str] = None,
        payment_method: Optional[str] = None,
        revenue_type: Optional[str] = None,
    ) -> _PeriodBundle:
        empty = _PeriodBundle(
            summary=SalonEarningsSummary(),
            revenue_sources=[],
            trend=[],
            services=[],
            products=[],
            staff_performance=[],
            filter_options=SalonEarningsFilterOptions(),
            invoice_aggs=[],
        )

        invoices = await self._load_invoices(actor, start, end)
        if not invoices:
            return empty

        payment_map = await self._payment_map([str(inv.id) for inv in invoices])
        appointment_map = await self._appointment_map(
            [inv.appointment_id for inv in invoices if inv.appointment_id]
        )
        tenant_id = self._resolve_tenant_id(actor)
        staff_configs = await self._load_staff_configs(tenant_id)
        product_ids = {
            item.item_id
            for inv in invoices
            for item in inv.items
            if item.item_type == "PRODUCT" and item.item_id
        }
        product_costs = await self._load_product_costs(
            tenant_id, self._resolve_salon_id(actor), product_ids
        )

        service_aggs: Dict[str, _LineAgg] = {}
        product_aggs: Dict[str, _LineAgg] = {}
        staff_aggs: Dict[str, _StaffAgg] = {}
        day_aggs: Dict[str, _DayAgg] = {}
        invoice_aggs: List[_InvoiceAgg] = []

        filter_staff: Dict[str, str] = {}
        filter_services: Dict[str, str] = {}
        filter_products: Dict[str, str] = {}
        filter_methods: Set[str] = set()

        total_service_net = 0.0
        total_product_net = 0.0
        total_discounts = 0.0
        total_refunds = 0.0
        total_taxes = 0.0
        total_incentives = 0.0
        total_product_cost_accum = 0.0
        total_product_incentives_accum = 0.0

        for invoice in invoices:
            appointment = appointment_map.get(invoice.appointment_id or "")
            if not self._eligible_invoice(invoice, appointment):
                continue

            for item in invoice.items:
                if item.staff_id:
                    filter_staff[item.staff_id] = item.staff_name or "Staff"
                if item.item_type == "SERVICE" and item.item_id:
                    filter_services[item.item_id] = item.name
                elif item.item_type == "PRODUCT" and item.item_id:
                    filter_products[item.item_id] = item.name
            if invoice.payment_method:
                filter_methods.add(invoice.payment_method.upper())

            if not self._passes_filters(
                invoice, staff_id, service_id, product_id, payment_method, revenue_type
            ):
                continue

            payments = payment_map.get(str(invoice.id), [])
            refund_ratio = self._refund_ratio(invoice, payments)
            incentive_eligible = self._eligible_for_incentive(invoice, appointment)
            raw_date = invoice.finalized_at or invoice.created_at
            ledger_date = _ensure_utc(raw_date) or start
            day_key = ledger_date.strftime("%Y-%m-%d")
            if day_key not in day_aggs:
                day_aggs[day_key] = _DayAgg()

            matching_items = [
                item
                for item in invoice.items
                if self._item_matches_filters(
                    item, staff_id, service_id, product_id, revenue_type
                )
            ]
            if not matching_items:
                continue

            matching_gross = sum(max(item.unit_price * item.quantity, 0.0) for item in matching_items)
            invoice_discount_share = float(invoice.discount_amount or 0.0)

            inv_agg = _InvoiceAgg(
                invoice=invoice,
                date=ledger_date,
                refund_amount=0.0,
                refund_ratio=refund_ratio,
            )
            invoice_line_refund = 0.0

            for item in matching_items:
                line_gross = round(max(item.unit_price * item.quantity, 0.0), 2)
                line_discount = float(item.discount or 0.0)
                if invoice_discount_share > 0 and matching_gross > 0:
                    line_discount += round(
                        invoice_discount_share * (line_gross / matching_gross), 2
                    )
                sales_subtotal = round(max(line_gross - line_discount, 0.0), 2)
                tax_amount = self._line_tax(sales_subtotal, item.tax_rate)
                refund_on_sales = round(sales_subtotal * refund_ratio, 2)
                net_sales = round(max(sales_subtotal - refund_on_sales, 0.0), 2)
                tax_after_refund = round(tax_amount * (1.0 - refund_ratio), 2)

                incentive = 0.0
                if incentive_eligible and item.staff_id:
                    cfg = staff_configs.get(item.staff_id, _StaffIncentiveConfig())
                    if cfg.incentive_base:
                        pct = (
                            cfg.service_pct
                            if item.item_type == "SERVICE"
                            else cfg.product_pct
                        )
                        incentive = round(net_sales * pct, 2)

                inv_agg.line_gross += line_gross
                inv_agg.line_discount += line_discount
                inv_agg.line_tax += tax_after_refund
                inv_agg.line_net += net_sales
                inv_agg.incentives += incentive
                invoice_line_refund += refund_on_sales

                if item.staff_name:
                    inv_agg.staff_names.add(item.staff_name)

                if item.item_type == "SERVICE":
                    inv_agg.service_names.append(item.name)
                    total_service_net += net_sales
                    day_aggs[day_key].service_revenue += net_sales
                    key = item.item_id or item.name
                    if key not in service_aggs:
                        service_aggs[key] = _LineAgg(
                            item_type="SERVICE", item_id=item.item_id or key, item_name=item.name
                        )
                    agg = service_aggs[key]
                    agg.times += 1
                    agg.quantity += item.quantity
                    agg.gross += line_gross
                    agg.discounts += line_discount
                    agg.refunds += refund_on_sales
                    agg.net += net_sales
                    agg.incentive += incentive
                    if item.staff_name:
                        agg.staff_names.add(item.staff_name)
                else:
                    inv_agg.product_names.append(item.name)
                    total_product_net += net_sales
                    total_product_incentives_accum += incentive
                    day_aggs[day_key].product_revenue += net_sales
                    key = item.item_id or item.name
                    if key not in product_aggs:
                        product_aggs[key] = _LineAgg(
                            item_type="PRODUCT", item_id=item.item_id or key, item_name=item.name
                        )
                    agg = product_aggs[key]
                    agg.times += 1
                    agg.quantity += item.quantity
                    agg.gross += line_gross
                    agg.discounts += line_discount
                    agg.refunds += refund_on_sales
                    agg.net += net_sales
                    agg.incentive += incentive
                    cost_unit = product_costs.get(item.item_id)
                    if cost_unit is not None and cost_unit > 0:
                        agg.has_product_cost = True
                        agg.buying_price_unit = cost_unit
                        effective_cost = round(cost_unit * item.quantity * (1.0 - refund_ratio), 2)
                        agg.product_cost += effective_cost
                        day_aggs[day_key].product_cost += effective_cost
                        total_product_cost_accum += effective_cost

                    if item.staff_name:
                        agg.staff_names.add(item.staff_name)

                total_discounts += line_discount
                total_taxes += tax_after_refund
                total_incentives += incentive
                day_aggs[day_key].total_revenue += net_sales
                day_aggs[day_key].incentives += incentive

                sid = item.staff_id or "unassigned"
                sname = item.staff_name or ("Unassigned" if sid == "unassigned" else "Staff")
                if sid not in staff_aggs:
                    staff_aggs[sid] = _StaffAgg(staff_id=sid, staff_name=sname)
                staff = staff_aggs[sid]
                if item.item_type == "SERVICE":
                    staff.services_performed += item.quantity
                    staff.service_revenue += net_sales
                else:
                    staff.product_sales += net_sales
                staff.incentive += incentive

            inv_agg.refund_amount = self._safe_round(invoice_line_refund)
            total_refunds += invoice_line_refund
            invoice_aggs.append(inv_agg)

        total_revenue = self._safe_round(total_service_net + total_product_net)
        total_discounts = self._safe_round(total_discounts)
        total_refunds = self._safe_round(total_refunds)
        total_taxes = self._safe_round(total_taxes)
        total_incentives = self._safe_round(total_incentives)
        total_product_cost_final = self._safe_round(total_product_cost_accum)
        product_incentives_final = self._safe_round(total_product_incentives_accum)
        net_salon_earnings = self._safe_round(
            total_revenue - total_product_cost_final - total_incentives
        )

        total_product_profit_final = self._safe_round(
            sum(
                (agg.net - agg.product_cost - agg.incentive)
                if agg.has_product_cost
                else (agg.net - agg.incentive)
                for agg in product_aggs.values()
            )
        )

        summary = SalonEarningsSummary(
            total_revenue=total_revenue,
            service_revenue=self._safe_round(total_service_net),
            product_revenue=self._safe_round(total_product_net),
            discounts=total_discounts,
            refunds=total_refunds,
            taxes=total_taxes,
            staff_incentives=total_incentives,
            total_product_cost=total_product_cost_final,
            product_staff_incentives=product_incentives_final,
            total_product_profit=total_product_profit_final,
            net_salon_earnings=net_salon_earnings,
            invoice_count=len(invoice_aggs),
        )

        revenue_sources: List[RevenueSource] = []
        for key, label, amount in (
            ("services", "Services", total_service_net),
            ("products", "Products", total_product_net),
        ):
            if amount > 0:
                revenue_sources.append(
                    RevenueSource(
                        key=key,
                        label=label,
                        amount=self._safe_round(amount),
                        percent=self._safe_round(
                            (amount / total_revenue) * 100.0 if total_revenue > 0 else 0.0
                        ),
                    )
                )

        services = [
            ServiceEarningsRow(
                service_id=agg.item_id,
                service_name=agg.item_name,
                times_performed=agg.times,
                gross_revenue=self._safe_round(agg.gross),
                discounts=self._safe_round(agg.discounts),
                net_revenue=self._safe_round(agg.net),
                staff_names=sorted(agg.staff_names),
                staff_incentive=self._safe_round(agg.incentive),
                salon_earnings=self._safe_round(agg.net - agg.incentive),
            )
            for agg in sorted(service_aggs.values(), key=lambda a: a.net, reverse=True)
        ]

        products: List[ProductEarningsRow] = []
        for agg in sorted(product_aggs.values(), key=lambda a: a.net, reverse=True):
            cost = self._safe_round(agg.product_cost) if agg.has_product_cost else None
            owner_profit = (
                self._safe_round(agg.net - agg.product_cost - agg.incentive)
                if agg.has_product_cost
                else self._safe_round(agg.net - agg.incentive)
            )
            unit_price = (
                self._safe_round(agg.gross / agg.quantity)
                if agg.quantity > 0
                else None
            )
            buying_price = (
                self._safe_round(agg.buying_price_unit)
                if agg.buying_price_unit is not None
                else (
                    self._safe_round(agg.product_cost / agg.quantity)
                    if (agg.has_product_cost and agg.quantity > 0)
                    else None
                )
            )
            staff_incentive_pct = (
                self._safe_round((agg.incentive / agg.net) * 100.0)
                if agg.net > 0 and agg.incentive > 0
                else 0.0
            )

            products.append(
                ProductEarningsRow(
                    product_id=agg.item_id,
                    product_name=agg.item_name,
                    quantity_sold=agg.quantity,
                    unit_price=unit_price,
                    gross_sales=self._safe_round(agg.gross),
                    discounts=self._safe_round(agg.discounts),
                    refunds=self._safe_round(agg.refunds),
                    net_sales=self._safe_round(agg.net),
                    sold_by=sorted(agg.staff_names),
                    buying_price=buying_price,
                    product_cost=cost,
                    staff_incentive_pct=staff_incentive_pct,
                    staff_incentive=self._safe_round(agg.incentive),
                    profit=owner_profit,
                    salon_earnings=owner_profit,
                )
            )

        staff_performance = [
            StaffPerformanceRow(
                staff_id=agg.staff_id,
                staff_name=agg.staff_name,
                services_performed=agg.services_performed,
                service_revenue=self._safe_round(agg.service_revenue),
                product_sales=self._safe_round(agg.product_sales),
                total_generated_revenue=self._safe_round(
                    agg.service_revenue + agg.product_sales
                ),
                incentive=self._safe_round(agg.incentive),
                salon_contribution=self._safe_round(
                    agg.service_revenue + agg.product_sales - agg.incentive
                ),
            )
            for agg in sorted(
                staff_aggs.values(),
                key=lambda a: a.service_revenue + a.product_sales,
                reverse=True,
            )
        ]

        filter_options = SalonEarningsFilterOptions(
            staff=[
                FilterOption(value=sid, label=name)
                for sid, name in sorted(filter_staff.items(), key=lambda x: x[1].lower())
            ],
            services=[
                FilterOption(value=sid, label=name)
                for sid, name in sorted(filter_services.items(), key=lambda x: x[1].lower())
            ],
            products=[
                FilterOption(value=pid, label=name)
                for pid, name in sorted(filter_products.items(), key=lambda x: x[1].lower())
            ],
            payment_methods=[
                FilterOption(value=method, label=method) for method in sorted(filter_methods)
            ],
        )

        return _PeriodBundle(
            summary=summary,
            revenue_sources=revenue_sources,
            trend=self._build_trend(start, end, day_aggs),
            services=services,
            products=products,
            staff_performance=staff_performance,
            filter_options=filter_options,
            invoice_aggs=invoice_aggs,
        )

    async def get_report(
        self,
        actor: User,
        month: Optional[int] = None,
        year: Optional[int] = None,
        period: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        staff_id: Optional[str] = None,
        service_id: Optional[str] = None,
        product_id: Optional[str] = None,
        payment_method: Optional[str] = None,
        revenue_type: Optional[str] = None,
    ) -> SalonEarningsReport:
        today = now_utc()
        start, end, active_month, active_year, range_label = self._resolve_range(
            today, month, year, period, start_date, end_date
        )

        current = await self._aggregate_period(
            actor,
            start,
            end,
            staff_id=staff_id,
            service_id=service_id,
            product_id=product_id,
            payment_method=payment_method,
            revenue_type=revenue_type,
        )

        prev_start, prev_end = self._previous_range(start, end, range_label)
        previous = await self._aggregate_period(
            actor,
            prev_start,
            prev_end,
            staff_id=staff_id,
            service_id=service_id,
            product_id=product_id,
            payment_method=payment_method,
            revenue_type=revenue_type,
        )

        has_previous = (
            previous.summary.invoice_count > 0 or previous.summary.total_revenue > 0
        )
        change_percent: Optional[float] = None
        if has_previous and previous.summary.net_salon_earnings != 0:
            change_percent = self._safe_round(
                (
                    (
                        current.summary.net_salon_earnings
                        - previous.summary.net_salon_earnings
                    )
                    / abs(previous.summary.net_salon_earnings)
                )
                * 100.0
            )
        elif has_previous and current.summary.net_salon_earnings != 0:
            change_percent = 100.0
        elif has_previous:
            change_percent = 0.0

        current.summary.comparison = PeriodComparison(
            current_amount=current.summary.net_salon_earnings,
            previous_amount=previous.summary.net_salon_earnings,
            change_percent=change_percent if has_previous else None,
            has_previous_data=has_previous,
        )

        return SalonEarningsReport(
            month=active_month,
            year=active_year,
            range_label=range_label,
            period_start=start,
            period_end=end - timedelta(microseconds=1),
            summary=current.summary,
            revenue_sources=current.revenue_sources,
            trend=current.trend,
            services=current.services,
            products=current.products,
            staff_performance=current.staff_performance,
            filter_options=current.filter_options,
        )

    async def list_transactions(
        self,
        actor: User,
        month: Optional[int] = None,
        year: Optional[int] = None,
        period: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        staff_id: Optional[str] = None,
        service_id: Optional[str] = None,
        product_id: Optional[str] = None,
        payment_method: Optional[str] = None,
        revenue_type: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
    ) -> SalonTransactionsResponse:
        today = now_utc()
        start, end, _, _, range_label = self._resolve_range(
            today, month, year, period, start_date, end_date
        )
        bundle = await self._aggregate_period(
            actor,
            start,
            end,
            staff_id=staff_id,
            service_id=service_id,
            product_id=product_id,
            payment_method=payment_method,
            revenue_type=revenue_type,
        )

        rows: List[SalonTransactionRow] = []
        for inv_agg in sorted(bundle.invoice_aggs, key=lambda r: r.date, reverse=True):
            invoice = inv_agg.invoice
            rows.append(
                SalonTransactionRow(
                    id=str(invoice.id),
                    invoice_number=invoice.invoice_number,
                    date=inv_agg.date,
                    client_name=invoice.customer_name,
                    services_summary=", ".join(inv_agg.service_names) or "—",
                    products_summary=", ".join(inv_agg.product_names) or "—",
                    gross_amount=self._safe_round(inv_agg.line_gross),
                    discount=self._safe_round(inv_agg.line_discount),
                    tax=self._safe_round(inv_agg.line_tax),
                    final_amount=self._safe_round(inv_agg.line_net + inv_agg.line_tax),
                    payment_method=invoice.payment_method,
                    payment_status=invoice.payment_status or "PENDING",
                    refund_amount=self._safe_round(inv_agg.refund_amount),
                    staff_summary=", ".join(sorted(inv_agg.staff_names)) or "—",
                )
            )

        total = len(rows)
        pages = max(math.ceil(total / max(limit, 1)), 1)
        page = min(max(page, 1), pages)
        start_idx = (page - 1) * limit
        page_rows = rows[start_idx : start_idx + limit]

        return SalonTransactionsResponse(
            items=page_rows,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
            period_start=start,
            period_end=end - timedelta(microseconds=1),
            range_label=range_label,
        )
