import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from beanie import PydanticObjectId

from app.auth.rbac_config import EMPLOYEE_TABLE_ROLES, normalize_role, ROLE_SUPER_ADMIN, ROLE_SALON_OWNER
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
from app.models.salon import Salon
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.payroll import (
    PayrollBreakdown,
    PayrollBreakdownRow,
    PayrollItem,
    PayrollPreviewResponse,
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
        from app.utils.user_name import user_display_name

        return user_display_name(user)

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
            manager_incentive=payroll.manager_incentive,
            bonus=payroll.bonus,
            deduction=payroll.deduction,
            final_salary=payroll.final_salary,
            final_paid_amount=payroll.final_paid_amount,
            payment_status=payroll.payment_status,
            payment_date=payroll.payment_date,
            generated_at=payroll.generated_at,
            generated_by=payroll.generated_by,
            is_locked=payroll.is_locked,
            version=payroll.version,
            calculation_log=payroll.calculation_log,
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
    ) -> Tuple[Dict[str, Dict[str, float]], int, int]:
        """
        Aggregate non-voided invoice line totals per staff for the given period.
        Returns: ({ staff_id: {"service": float, "product": float} }, eligible_invoice_count, cancelled_app_count)
        """
        start, end = self._month_range(month, year)
        invoices = await Invoice.find(
            {
                "tenant_id": salon_id,
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
        eligible_count = 0
        for invoice in invoices:
            if invoice.appointment_id and invoice.appointment_id in cancelled_ids:
                continue
            eligible_count += 1
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
                    bucket["service"] = round(bucket["service"] + line_total, 2)
                elif item.item_type == "PRODUCT":
                    bucket["product"] = round(bucket["product"] + line_total, 2)

        return totals, eligible_count, len(cancelled_ids)

    # ------------------------------------------------------------------ #
    # Monthly Salary (Tab 2) & Preview
    # ------------------------------------------------------------------ #
    async def preview_payroll(
        self, actor: User, month: int, year: int
    ) -> PayrollPreviewResponse:
        """
        Preview calculated payroll items for a given month/year without saving to DB.
        Exposes transparent breakdown of Fixed Salary, Service/Product Incentives, and Manager Incentives.
        """
        salon_id = self._resolve_salon_id(actor)
        employees = await self._list_employee_users(salon_id, active_only=True)
        if not employees:
            raise ResourceNotFoundException("No active employees found for payroll preview")

        existing = await Payroll.find(
            {
                "tenant_id": salon_id,
                "month": month,
                "year": year,
                "is_deleted": False,
            }
        ).to_list()
        payroll_exists = len(existing) > 0
        has_paid_records = any(p.payment_status == PAYMENT_STATUS_PAID for p in existing)

        sales, eligible_count, cancelled_count = await self._sales_by_staff(salon_id, month, year)

        items: List[PayrollItem] = []
        tot_base = 0.0
        tot_svc_inc = 0.0
        tot_prod_inc = 0.0
        tot_mgr_inc = 0.0
        tot_gross = 0.0

        for emp in employees:
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

            # Manager incentive calculation for manager role if configured
            is_manager = emp.role in {"salon_manager", "salon_admin"}
            manager_incentive = 0.0

            # Deductions are explicitly ZERO (attendance is for reporting only)
            deduction = 0.0
            bonus = 0.0
            gross_salary = round(
                base_salary + service_incentive + product_incentive + manager_incentive + bonus, 2
            )

            tot_base = round(tot_base + base_salary, 2)
            tot_svc_inc = round(tot_svc_inc + service_incentive, 2)
            tot_prod_inc = round(tot_prod_inc + product_incentive, 2)
            tot_mgr_inc = round(tot_mgr_inc + manager_incentive, 2)
            tot_gross = round(tot_gross + gross_salary, 2)

            calc_log = {
                "employee_id": emp_id,
                "employee_name": self._full_name(emp),
                "month": month,
                "year": year,
                "configured_salary": base_salary,
                "service_sales_total": service_sales,
                "product_sales_total": product_sales,
                "service_incentive_percent": svc_pct if incentive_enabled else 0.0,
                "product_incentive_percent": prod_pct if incentive_enabled else 0.0,
                "service_incentive": service_incentive,
                "product_incentive": product_incentive,
                "manager_incentive": manager_incentive,
                "bonus": bonus,
                "deduction": deduction,
                "gross_salary": gross_salary,
                "formula": f"Gross Salary ({gross_salary:.2f}) = Base ({base_salary:.2f}) + Service Incentive ({service_incentive:.2f}) + Product Incentive ({product_incentive:.2f}) + Manager Incentive ({manager_incentive:.2f})",
                "attendance_notes": "Attendance ignored (reporting only per payroll rules)",
                "eligible_invoices_count": eligible_count,
                "cancelled_appointments_excluded": cancelled_count,
            }

            items.append(
                PayrollItem(
                    id=f"preview-{emp_id}",
                    employee_id=emp_id,
                    employee_name=self._full_name(emp),
                    employee_role=emp.role,
                    salary_type=emp.salary_type or DEFAULT_SALARY_TYPE,
                    month=month,
                    year=year,
                    base_salary=base_salary,
                    service_incentive=service_incentive,
                    product_incentive=product_incentive,
                    manager_incentive=manager_incentive,
                    bonus=bonus,
                    deduction=0.0,
                    final_salary=gross_salary,
                    final_paid_amount=0.0,
                    payment_status=PAYMENT_STATUS_PENDING,
                    generated_at=now_utc(),
                    generated_by=str(actor.id),
                    is_locked=True,
                    version=1,
                    calculation_log=calc_log,
                )
            )

        items.sort(key=lambda p: (p.employee_name or "").lower())
        return PayrollPreviewResponse(
            items=items,
            payroll_exists=payroll_exists,
            has_paid_records=has_paid_records,
            total_base_salary=tot_base,
            total_service_incentive=tot_svc_inc,
            total_product_incentive=tot_prod_inc,
            total_manager_incentive=tot_mgr_inc,
            total_gross_salary=tot_gross,
            message="Payroll preview calculated successfully",
        )

    async def generate_payroll(
        self, actor: User, month: int, year: int, force_regenerate: bool = False
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

        if existing:
            paid_records = [p for p in existing if p.payment_status == PAYMENT_STATUS_PAID]
            if paid_records:
                raise BookingConflictException(
                    detail="Payroll for this period has already been paid and locked. Historical records are immutable."
                )
            if not force_regenerate:
                raise BookingConflictException(
                    detail="Payroll for this period has already been generated. Use regenerate option to update unpaid records."
                )

        sales, eligible_count, cancelled_count = await self._sales_by_staff(salon_id, month, year)

        existing_by_emp = {p.employee_id: p for p in existing}
        created_or_updated: List[Payroll] = []
        gen_time = now_utc()

        for emp in employees:
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
            manager_incentive = 0.0
            bonus = 0.0
            # Strict rule: Attendance deduction is NEVER automatically applied.
            deduction = 0.0
            gross_salary = round(
                base_salary + service_incentive + product_incentive + manager_incentive + bonus, 2
            )

            existing_record = existing_by_emp.get(emp_id)
            next_version = (existing_record.version + 1) if existing_record else 1

            calc_log = {
                "employee_id": emp_id,
                "employee_name": self._full_name(emp),
                "month": month,
                "year": year,
                "configured_salary": base_salary,
                "service_sales_total": service_sales,
                "product_sales_total": product_sales,
                "service_incentive_percent": svc_pct if incentive_enabled else 0.0,
                "product_incentive_percent": prod_pct if incentive_enabled else 0.0,
                "service_incentive": service_incentive,
                "product_incentive": product_incentive,
                "manager_incentive": manager_incentive,
                "bonus": bonus,
                "deduction": deduction,
                "gross_salary": gross_salary,
                "formula": f"Gross Salary ({gross_salary:.2f}) = Base ({base_salary:.2f}) + Service Incentive ({service_incentive:.2f}) + Product Incentive ({product_incentive:.2f}) + Manager Incentive ({manager_incentive:.2f})",
                "attendance_notes": "Attendance ignored (reporting only per payroll rules)",
                "eligible_invoices_count": eligible_count,
                "cancelled_appointments_excluded": cancelled_count,
                "version": next_version,
                "generated_at": gen_time.isoformat(),
                "generated_by": str(actor.id),
            }

            if existing_record:
                existing_record.employee_name = self._full_name(emp)
                existing_record.employee_role = emp.role
                existing_record.salary_type = emp.salary_type or DEFAULT_SALARY_TYPE
                existing_record.base_salary = base_salary
                existing_record.service_incentive_percent = svc_pct if incentive_enabled else 0.0
                existing_record.product_incentive_percent = prod_pct if incentive_enabled else 0.0
                existing_record.service_sales_total = service_sales
                existing_record.product_sales_total = product_sales
                existing_record.service_incentive = service_incentive
                existing_record.product_incentive = product_incentive
                existing_record.manager_incentive = manager_incentive
                existing_record.bonus = bonus
                existing_record.deduction = 0.0
                existing_record.final_salary = gross_salary
                existing_record.generated_at = gen_time
                existing_record.generated_by = str(actor.id)
                existing_record.is_locked = True
                existing_record.version = next_version
                existing_record.calculation_log = calc_log
                existing_record.updated_by = str(actor.id)
                await existing_record.save()
                created_or_updated.append(existing_record)
            else:
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
                    manager_incentive=manager_incentive,
                    bonus=bonus,
                    deduction=0.0,
                    final_salary=gross_salary,
                    final_paid_amount=0.0,
                    payment_status=PAYMENT_STATUS_PENDING,
                    generated_at=gen_time,
                    generated_by=str(actor.id),
                    is_locked=True,
                    version=1,
                    calculation_log=calc_log,
                    created_by=str(actor.id),
                )
                await payroll.insert()
                created_or_updated.append(payroll)

        created_or_updated.sort(key=lambda p: (p.employee_name or "").lower())
        return [self._to_payroll_item(p) for p in created_or_updated]

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
            PayrollBreakdownRow(type="Configured Base Salary", amount=payroll.base_salary),
            PayrollBreakdownRow(type="Service Incentive", amount=payroll.service_incentive),
            PayrollBreakdownRow(type="Product Incentive", amount=payroll.product_incentive),
            PayrollBreakdownRow(type="Manager Incentive", amount=payroll.manager_incentive),
            PayrollBreakdownRow(type="Bonus", amount=payroll.bonus),
            PayrollBreakdownRow(type="Deductions", amount=0.0),
            PayrollBreakdownRow(type="Gross Salary", amount=payroll.final_salary),
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
            manager_incentive=payroll.manager_incentive,
            bonus=payroll.bonus,
            deduction=0.0,
            final_salary=payroll.final_salary,
            final_paid_amount=payroll.final_paid_amount,
            payment_status=payroll.payment_status,
            payment_date=payroll.payment_date,
            generated_at=payroll.generated_at,
            generated_by=payroll.generated_by,
            is_locked=payroll.is_locked,
            version=payroll.version,
            calculation_log=payroll.calculation_log,
            rows=rows,
        )

    async def get_salary_slip(self, actor: User, payroll_id: str) -> Dict[str, Any]:
        payroll = await self._get_payroll_in_scope(actor, payroll_id)
        breakdown = await self.get_breakdown(actor, payroll_id)

        salon_name: Optional[str] = None
        salon_phone: Optional[str] = None
        salon_email: Optional[str] = None
        salon_address: Any = None
        tenant = await Tenant.get(payroll.tenant_id) if payroll.tenant_id else None
        if tenant:
            salon_name = tenant.name

        salon = None
        if payroll.salon_id:
            try:
                salon = await Salon.find_one(
                    {"_id": PydanticObjectId(payroll.salon_id), "is_deleted": False}
                )
            except Exception:
                salon = None
        if salon is None and payroll.tenant_id:
            salon = await Salon.find_one(
                {"tenant_id": payroll.tenant_id, "is_deleted": False}
            )
        if salon:
            salon_name = salon.name or salon_name
            salon_phone = salon.phone or None
            salon_email = salon.email
            salon_address = salon.address or None

        if not salon_phone or not salon_email or not salon_address:
            owner = None
            if payroll.tenant_id:
                owner = await User.find_one(
                    {
                        "tenant_id": payroll.tenant_id,
                        "role": ROLE_SALON_OWNER,
                        "is_deleted": False,
                    }
                )
            if owner:
                if not salon_phone:
                    salon_phone = owner.salon_phone_number or owner.phone
                if not salon_email:
                    salon_email = owner.email
                if not salon_address and owner.address:
                    salon_address = owner.address
                if not salon_name:
                    salon_name = owner.salon_name

        employee_phone: Optional[str] = None
        employee_code: Optional[str] = None
        if payroll.employee_id:
            try:
                employee = await User.get(PydanticObjectId(payroll.employee_id))
                if employee:
                    employee_phone = employee.phone
                    employee_code = employee.employee_code
            except Exception:
                employee_phone = None
                employee_code = None

        data = breakdown.model_dump(mode="json")
        data["salon_id"] = payroll.salon_id
        data["salon_name"] = salon_name
        data["salon_phone"] = salon_phone
        data["salon_email"] = salon_email
        data["salon_address"] = salon_address
        data["employee_phone"] = employee_phone
        data["employee_code"] = employee_code
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
