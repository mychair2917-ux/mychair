import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from beanie import PydanticObjectId

from app.auth.rbac_config import EMPLOYEE_TABLE_ROLES, normalize_role, ROLE_SUPER_ADMIN
from app.constants.attendance_options import (
    ATTENDANCE_STATUS_ABSENT,
    ATTENDANCE_STATUS_HALF_DAY,
)
from app.constants.payroll_options import (
    DEFAULT_SALARY_TYPE,
    PAYMENT_STATUS_PAID,
    PAYMENT_STATUS_PENDING,
)
from app.core import tenant_context
from app.core.exceptions import (
    BookingConflictException,
    PermissionDeniedException,
    ResourceNotFoundException,
)
from app.models.appointment import Appointment
from app.models.attendance import Attendance
from app.models.billing import Invoice, Payment
from app.models.payroll import Payroll
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.payroll import (
    PayrollBreakdown,
    PayrollBreakdownRow,
    PayrollItem,
    SalaryStructureItem,
    SalaryStructureUpdate,
)
from app.services.leave import AttendanceReconciliationService
from app.utils.timezone import now_utc


class PayrollService:
    """Business logic for salary structure and monthly payroll generation."""

    def __init__(self) -> None:
        self.logger = logging.getLogger(__name__)
        self.reconciliation_service = AttendanceReconciliationService()

    # ------------------------------------------------------------------ #
    # Helpers
    # ------------------------------------------------------------------ #
    def _resolve_salon_id(self, actor: User) -> str:
        """Resolve the active salon (tenant) scope for the current request."""
        salon_id = tenant_context.get_tenant_id() or actor.tenant_id
        if not salon_id:
            raise PermissionDeniedException(
                detail="No salon associated with your account"
            )
        return salon_id

    @staticmethod
    def _full_name(user: User) -> str:
        parts = [user.first_name or "", user.last_name or ""]
        name = " ".join(p for p in parts if p).strip()
        return name or user.email

    @staticmethod
    def _month_range(month: int, year: int) -> Tuple[datetime, datetime]:
        """Return [start, end) UTC datetimes bounding the given month."""
        start = datetime(year, month, 1, tzinfo=timezone.utc)
        if month == 12:
            end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
        else:
            end = datetime(year, month + 1, 1, tzinfo=timezone.utc)
        return start, end

    async def _list_employee_users(
        self, salon_id: str, active_only: bool = False
    ) -> List[User]:
        query: Dict[str, Any] = {
            "tenant_id": salon_id,
            "is_deleted": False,
            "role": {"$in": list(EMPLOYEE_TABLE_ROLES)},
        }
        if active_only:
            query["is_active"] = True
        return await User.find(query).to_list()

    @staticmethod
    def _to_structure_item(user: User) -> SalaryStructureItem:
        return SalaryStructureItem(
            employee_id=str(user.id),
            employee_name=PayrollService._full_name(user),
            role=user.role,
            salary=user.salary or 0.0,
            salary_type=user.salary_type or DEFAULT_SALARY_TYPE,
            incentive_base=bool(user.incentive_base),
            service_incentive_percent=user.service_incentive_percent or 0.0,
            product_incentive_percent=user.product_incentive_percent or 0.0,
            joining_date=user.joining_date,
            is_active=user.is_active,
        )

    @staticmethod
    def _to_payroll_item(payroll: Payroll) -> PayrollItem:
        return PayrollItem(
            id=str(payroll.id),
            employee_id=payroll.employee_id,
            employee_name=payroll.employee_name,
            employee_role=payroll.employee_role,
            salary_type=payroll.salary_type,
            month=payroll.month,
            year=payroll.year,
            base_salary=payroll.base_salary,
            service_incentive=payroll.service_incentive,
            product_incentive=payroll.product_incentive,
            bonus=payroll.bonus,
            deduction=payroll.deduction,
            final_salary=payroll.final_salary,
            final_paid_amount=payroll.final_paid_amount,
            payment_status=payroll.payment_status,
            payment_date=payroll.payment_date,
            generated_at=payroll.generated_at,
        )

    # ------------------------------------------------------------------ #
    # Salary Structure (Tab 1)
    # ------------------------------------------------------------------ #
    async def list_salary_structure(self, actor: User) -> List[SalaryStructureItem]:
        salon_id = self._resolve_salon_id(actor)
        users = await self._list_employee_users(salon_id)
        return [self._to_structure_item(u) for u in users if u]

    async def update_salary_structure(
        self, actor: User, employee_id: str, payload: SalaryStructureUpdate
    ) -> SalaryStructureItem:
        salon_id = self._resolve_salon_id(actor)

        try:
            obj_id = PydanticObjectId(employee_id)
        except Exception as exc:
            raise ResourceNotFoundException("Employee not found") from exc

        user = await User.find_one({"_id": obj_id, "is_deleted": False})
        if not user or user.role not in EMPLOYEE_TABLE_ROLES:
            raise ResourceNotFoundException("Employee not found")

        if normalize_role(actor.role) != ROLE_SUPER_ADMIN and user.tenant_id != salon_id:
            raise PermissionDeniedException(detail="Cross-tenant access denied")

        if payload.incentive_base:
            if payload.service_incentive_percent is None:
                raise PermissionDeniedException(
                    detail="Service incentive % is required when incentive base is enabled"
                )
            if payload.product_incentive_percent is None:
                raise PermissionDeniedException(
                    detail="Product incentive % is required when incentive base is enabled"
                )

        user.salary = payload.salary
        user.salary_type = payload.salary_type
        if payload.joining_date is not None:
            user.joining_date = payload.joining_date
        user.incentive_base = payload.incentive_base
        if payload.incentive_base:
            user.service_incentive_percent = payload.service_incentive_percent or 0.0
            user.product_incentive_percent = payload.product_incentive_percent or 0.0
        else:
            user.service_incentive_percent = 0.0
            user.product_incentive_percent = 0.0
        user.updated_by = str(actor.id)
        await user.save()

        return self._to_structure_item(user)

    # ------------------------------------------------------------------ #
    # Incentive calculation
    # ------------------------------------------------------------------ #
    async def _sales_by_staff(
        self, salon_id: str, month: int, year: int
    ) -> Dict[str, Dict[str, float]]:
        """
        Aggregate non-voided invoice line totals per staff for the given period.
        Returns: { staff_id: {"service": float, "product": float} }
        """
        start, end = self._month_range(month, year)
        invoices = await Invoice.find(
            {
                "salon_id": salon_id,
                "is_deleted": False,
                "status": {"$ne": "VOIDED"},
                "created_at": {"$gte": start, "$lt": end},
            }
        ).to_list()

        appointment_ids = [invoice.appointment_id for invoice in invoices if invoice.appointment_id]
        cancelled_ids = set()
        if appointment_ids:
            cancelled_appointments = await Appointment.find(
                {
                    "_id": {
                        "$in": [
                            PydanticObjectId(app_id)
                            for app_id in appointment_ids
                            if app_id
                        ]
                    },
                    "status": "CANCELLED",
                    "is_deleted": False,
                }
            ).to_list()
            cancelled_ids = {str(appointment.id) for appointment in cancelled_appointments}

        payments = await Payment.find(
            {
                "invoice_id": {"$in": [str(invoice.id) for invoice in invoices]},
                "is_deleted": False,
            }
        ).to_list()
        refunds_by_invoice: Dict[str, float] = {}
        for payment in payments:
            refunds_by_invoice[payment.invoice_id] = round(
                refunds_by_invoice.get(payment.invoice_id, 0.0)
                + max(payment.refunded_amount, 0.0),
                2,
            )

        totals: Dict[str, Dict[str, float]] = {}
        for invoice in invoices:
            if invoice.appointment_id and invoice.appointment_id in cancelled_ids:
                continue
            refund_ratio = 0.0
            if invoice.total_amount > 0:
                refund_ratio = min(
                    max(refunds_by_invoice.get(str(invoice.id), 0.0) / invoice.total_amount, 0.0),
                    1.0,
                )
            for item in invoice.items:
                if not item.staff_id:
                    continue
                line_total = (item.unit_price * item.quantity) - item.discount
                if line_total < 0:
                    line_total = 0.0
                line_total = round(line_total * (1.0 - refund_ratio), 2)
                bucket = totals.setdefault(item.staff_id, {"service": 0.0, "product": 0.0})
                if item.item_type == "SERVICE":
                    bucket["service"] += line_total
                elif item.item_type == "PRODUCT":
                    bucket["product"] += line_total
        return totals

    async def _attendance_deduction(
        self,
        salon_id: str,
        employee_id: str,
        month: int,
        year: int,
        base_salary: float,
    ) -> float:
        """Deduct pro-rated salary for absent and half-day records; leave/week-off excluded."""
        if base_salary <= 0:
            return 0.0

        from calendar import monthrange

        last_day = monthrange(year, month)[1]
        start_date = f"{year:04d}-{month:02d}-01"
        end_date = f"{year:04d}-{month:02d}-{last_day:02d}"

        records = await Attendance.find(
            {
                "tenant_id": salon_id,
                "staff_id": employee_id,
                "date": {"$gte": start_date, "$lte": end_date},
                "is_deleted": False,
            }
        ).to_list()

        absent_units = 0.0
        for record in records:
            if record.status == ATTENDANCE_STATUS_ABSENT:
                absent_units += 1.0
            elif record.status == ATTENDANCE_STATUS_HALF_DAY:
                absent_units += 0.5

        if absent_units <= 0:
            return 0.0

        per_day = base_salary / last_day
        return round(per_day * absent_units, 2)

    # ------------------------------------------------------------------ #
    # Monthly Salary (Tab 2)
    # ------------------------------------------------------------------ #
    async def generate_payroll(
        self, actor: User, month: int, year: int
    ) -> List[PayrollItem]:
        salon_id = self._resolve_salon_id(actor)
        await self.reconciliation_service.reconcile_for_actor(actor, salon_id=salon_id)

        employees = await self._list_employee_users(salon_id, active_only=True)
        if not employees:
            raise ResourceNotFoundException(
                "No active employees found to generate payroll"
            )

        existing = await Payroll.find(
            {
                "tenant_id": salon_id,
                "month": month,
                "year": year,
                "is_deleted": False,
            }
        ).to_list()
        existing_ids = {p.employee_id for p in existing}

        pending_employees = [e for e in employees if str(e.id) not in existing_ids]
        if not pending_employees:
            raise BookingConflictException(
                detail="Payroll for this period has already been generated"
            )

        sales = await self._sales_by_staff(salon_id, month, year)

        created: List[Payroll] = []
        for emp in pending_employees:
            emp_id = str(emp.id)
            emp_sales = sales.get(emp_id, {"service": 0.0, "product": 0.0})
            service_sales = round(emp_sales["service"], 2)
            product_sales = round(emp_sales["product"], 2)

            incentive_enabled = bool(emp.incentive_base)
            svc_pct = emp.service_incentive_percent or 0.0
            prod_pct = emp.product_incentive_percent or 0.0

            service_incentive = (
                round(service_sales * svc_pct / 100.0, 2) if incentive_enabled else 0.0
            )
            product_incentive = (
                round(product_sales * prod_pct / 100.0, 2) if incentive_enabled else 0.0
            )
            base_salary = round(emp.salary or 0.0, 2)
            bonus = 0.0
            deduction = await self._attendance_deduction(
                salon_id, emp_id, month, year, base_salary
            )
            final_salary = round(
                base_salary + service_incentive + product_incentive + bonus - deduction, 2
            )

            payroll = Payroll(
                salon_id=salon_id,
                tenant_id=salon_id,
                employee_id=emp_id,
                employee_name=self._full_name(emp),
                employee_role=emp.role,
                salary_type=emp.salary_type or DEFAULT_SALARY_TYPE,
                month=month,
                year=year,
                base_salary=base_salary,
                service_incentive_percent=svc_pct if incentive_enabled else 0.0,
                product_incentive_percent=prod_pct if incentive_enabled else 0.0,
                service_sales_total=service_sales,
                product_sales_total=product_sales,
                service_incentive=service_incentive,
                product_incentive=product_incentive,
                bonus=bonus,
                deduction=deduction,
                final_salary=final_salary,
                final_paid_amount=0.0,
                payment_status=PAYMENT_STATUS_PENDING,
                generated_at=now_utc(),
                created_by=str(actor.id),
            )
            await payroll.insert()
            created.append(payroll)

        all_period = existing + created
        all_period.sort(key=lambda p: (p.employee_name or "").lower())
        return [self._to_payroll_item(p) for p in all_period]

    async def list_payroll(
        self, actor: User, month: int, year: int
    ) -> List[PayrollItem]:
        salon_id = self._resolve_salon_id(actor)
        payrolls = await Payroll.find(
            {
                "tenant_id": salon_id,
                "month": month,
                "year": year,
                "is_deleted": False,
            }
        ).to_list()
        payrolls.sort(key=lambda p: (p.employee_name or "").lower())
        return [self._to_payroll_item(p) for p in payrolls]

    async def _get_payroll_in_scope(self, actor: User, payroll_id: str) -> Payroll:
        salon_id = self._resolve_salon_id(actor)
        try:
            obj_id = PydanticObjectId(payroll_id)
        except Exception as exc:
            raise ResourceNotFoundException("Payroll record not found") from exc

        payroll = await Payroll.find_one({"_id": obj_id, "is_deleted": False})
        if not payroll:
            raise ResourceNotFoundException("Payroll record not found")
        if normalize_role(actor.role) != ROLE_SUPER_ADMIN and payroll.tenant_id != salon_id:
            raise PermissionDeniedException(detail="Cross-tenant access denied")
        return payroll

    async def mark_paid(self, actor: User, payroll_id: str) -> PayrollItem:
        payroll = await self._get_payroll_in_scope(actor, payroll_id)
        if payroll.payment_status == PAYMENT_STATUS_PAID:
            return self._to_payroll_item(payroll)
        payroll.payment_status = PAYMENT_STATUS_PAID
        payroll.payment_date = now_utc()
        payroll.final_paid_amount = payroll.final_salary
        payroll.updated_by = str(actor.id)
        await payroll.save()
        return self._to_payroll_item(payroll)

    async def get_breakdown(self, actor: User, payroll_id: str) -> PayrollBreakdown:
        payroll = await self._get_payroll_in_scope(actor, payroll_id)
        rows = [
            PayrollBreakdownRow(type="Base Salary", amount=payroll.base_salary),
            PayrollBreakdownRow(type="Service Incentive", amount=payroll.service_incentive),
            PayrollBreakdownRow(type="Product Incentive", amount=payroll.product_incentive),
            PayrollBreakdownRow(type="Bonus", amount=payroll.bonus),
            PayrollBreakdownRow(type="Deductions", amount=-payroll.deduction),
            PayrollBreakdownRow(type="Final Salary", amount=payroll.final_salary),
        ]
        return PayrollBreakdown(
            id=str(payroll.id),
            employee_id=payroll.employee_id,
            employee_name=payroll.employee_name,
            employee_role=payroll.employee_role,
            month=payroll.month,
            year=payroll.year,
            salary_type=payroll.salary_type,
            base_salary=payroll.base_salary,
            service_incentive_percent=payroll.service_incentive_percent,
            product_incentive_percent=payroll.product_incentive_percent,
            service_sales_total=payroll.service_sales_total,
            product_sales_total=payroll.product_sales_total,
            service_incentive=payroll.service_incentive,
            product_incentive=payroll.product_incentive,
            bonus=payroll.bonus,
            deduction=payroll.deduction,
            final_salary=payroll.final_salary,
            final_paid_amount=payroll.final_paid_amount,
            payment_status=payroll.payment_status,
            payment_date=payroll.payment_date,
            rows=rows,
        )

    async def get_salary_slip(self, actor: User, payroll_id: str) -> Dict[str, Any]:
        payroll = await self._get_payroll_in_scope(actor, payroll_id)
        breakdown = await self.get_breakdown(actor, payroll_id)

        salon_name: Optional[str] = None
        tenant = await Tenant.get(payroll.tenant_id) if payroll.tenant_id else None
        if tenant:
            salon_name = tenant.name

        data = breakdown.model_dump(mode="json")
        data["salon_id"] = payroll.salon_id
        data["salon_name"] = salon_name
        data["generated_at"] = (
            payroll.generated_at.isoformat() if payroll.generated_at else None
        )
        return data

    # ------------------------------------------------------------------ #
    # Salary History (Tab 3)
    # ------------------------------------------------------------------ #
    async def list_history(
        self,
        actor: User,
        month: Optional[int] = None,
        year: Optional[int] = None,
        employee_id: Optional[str] = None,
        payment_status: Optional[str] = None,
        page: int = 1,
        limit: int = 20,
        sort_by: str = "year",
        sort_order: str = "desc",
    ) -> Dict[str, Any]:
        salon_id = self._resolve_salon_id(actor)

        query: Dict[str, Any] = {
            "tenant_id": salon_id,
            "is_deleted": False,
        }
        if month is not None:
            query["month"] = month
        if year is not None:
            query["year"] = year
        if employee_id:
            query["employee_id"] = employee_id
        if payment_status:
            query["payment_status"] = payment_status.strip().upper()

        allowed_sort = {
            "year",
            "month",
            "final_salary",
            "base_salary",
            "employee_name",
            "payment_status",
            "generated_at",
        }
        sort_field = sort_by if sort_by in allowed_sort else "year"
        prefix = "-" if sort_order.lower() == "desc" else "+"
        # Stable secondary sort by month when sorting by year
        sort_exprs = [f"{prefix}{sort_field}"]
        if sort_field == "year":
            sort_exprs.append(f"{prefix}month")

        total = await Payroll.find(query).count()
        skip = (page - 1) * limit
        cursor = Payroll.find(query)
        for expr in sort_exprs:
            cursor = cursor.sort(expr)
        payrolls = await cursor.skip(skip).limit(limit).to_list()

        pages = max(1, (total + limit - 1) // limit) if total > 0 else 1
        return {
            "items": [self._to_payroll_item(p).model_dump(mode="json") for p in payrolls],
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        }
