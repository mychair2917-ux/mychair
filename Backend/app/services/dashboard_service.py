from __future__ import annotations

from collections import defaultdict
from beanie import PydanticObjectId
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from app.auth.module_permission_registry import (
    BILLING_BILLS,
    can_access_permission,
)
from app.auth.permissions import has_permission
from app.auth.rbac_config import (
    ROLE_EMPLOYEE,
    ROLE_SALON_ADMIN,
    ROLE_SALON_MANAGER,
    ROLE_SALON_OWNER,
    ROLE_SUPER_ADMIN,
    Module,
    normalize_role,
)
from app.constants.leave_options import LEAVE_STATUS_PENDING
from app.core import tenant_context
from app.core.exceptions import ResourceNotFoundException
from app.models.appointment import Appointment
from app.models.billing import Invoice
from app.models.customer import Customer
from app.models.inventory import ProductInventory
from app.models.leave_request import LeaveRequest
from app.models.notification import Notification
from app.models.notification_communication import BusinessAlert, SubscriptionNotification
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.dashboard import (
    AttendanceSnapshot,
    DashboardAlert,
    DashboardAppointmentItem,
    DashboardKpi,
    DashboardOperation,
    DashboardQuickAction,
    DashboardResponse,
    DashboardRoleView,
    PerformanceItem,
    StaffAttendanceStatus,
    StaffPerformanceMetrics,
    TrendPoint,
)
from app.services.attendance import AttendanceService
from app.services.inventory import InventoryService
from app.services.my_earnings import MyEarningsService
from app.services.subscription_service import SubscriptionService
from app.utils.timezone import now_utc

PAID_STATUSES = {"PAID", "PARTIALLY_PAID"}
ACTIVE_APPOINTMENT_STATUSES = {
    "BOOKED",
    "CONFIRMED",
    "CHECKED_IN",
    "IN_PROGRESS",
}
COMPLETED_APPOINTMENT_STATUSES = {"COMPLETED"}
STAFF_ROLES = {ROLE_SALON_MANAGER, ROLE_EMPLOYEE}


class DashboardService:
    def __init__(self) -> None:
        self._attendance_service = AttendanceService()
        self._inventory_service = InventoryService()
        self._earnings_service = MyEarningsService()
        self._subscription_service = SubscriptionService()

    @staticmethod
    def _resolve_role_view(role: str) -> DashboardRoleView:
        normalized = normalize_role(role) or role
        if normalized == ROLE_SUPER_ADMIN:
            return "super_admin"
        if normalized in {ROLE_SALON_OWNER, ROLE_SALON_ADMIN}:
            return "admin"
        if normalized == ROLE_SALON_MANAGER:
            return "manager"
        return "staff"

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
    def _format_currency(amount: float) -> str:
        return f"{round(amount, 2):,.2f}"

    @staticmethod
    def _format_time(dt: datetime) -> str:
        aware = dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        return aware.astimezone(timezone.utc).strftime("%I:%M %p").lstrip("0")

    def _can_access_module(
        self, role: str, module: Module, merged_permissions: Dict[str, bool]
    ) -> bool:
        return can_access_permission(role, module.value, merged_permissions)

    def _can_view_billing(
        self, role: str, merged_permissions: Dict[str, bool]
    ) -> bool:
        normalized = normalize_role(role) or role
        if self._can_access_module(normalized, Module.BILLING_FINANCE, merged_permissions):
            return True
        return has_permission(normalized, "billing.view")

    def _can_view_inventory(
        self, role: str, merged_permissions: Dict[str, bool]
    ) -> bool:
        normalized = normalize_role(role) or role
        if self._can_access_module(normalized, Module.PRODUCTS_INVENTORY, merged_permissions):
            return True
        return has_permission(normalized, "inventory.view")

    def _can_view_attendance(
        self, role: str, merged_permissions: Dict[str, bool]
    ) -> bool:
        normalized = normalize_role(role) or role
        if self._can_access_module(normalized, Module.ATTENDANCE, merged_permissions):
            return True
        return has_permission(normalized, "attendance.view")

    def _can_view_analytics(
        self, role: str, merged_permissions: Dict[str, bool]
    ) -> bool:
        normalized = normalize_role(role) or role
        if self._can_access_module(normalized, Module.CUSTOMER_ANALYTICS, merged_permissions):
            return True
        return has_permission(normalized, "analytics.view")

    def _can_approve_leave(
        self, role: str, merged_permissions: Dict[str, bool]
    ) -> bool:
        normalized = normalize_role(role) or role
        if normalized not in {ROLE_SUPER_ADMIN, ROLE_SALON_OWNER}:
            return False
        return has_permission(normalized, "leave.approve") or self._can_access_module(
            normalized, Module.LEAVE, merged_permissions
        )

    async def _count_pending_leave_requests(
        self, tenant_id: Optional[str] = None
    ) -> int:
        query: Dict[str, Any] = {
            "is_deleted": False,
            "status": LEAVE_STATUS_PENDING,
        }
        if tenant_id:
            query["tenant_id"] = tenant_id
        return await LeaveRequest.find(query).count()

    def _resolve_tenant_scope(
        self, user: User, salon_id: Optional[str]
    ) -> Optional[str]:
        normalized = normalize_role(user.role) or user.role
        if normalized == ROLE_SUPER_ADMIN:
            return (salon_id or tenant_context.get_tenant_id() or "").strip() or None
        return str(user.tenant_id or "").strip() or None

    def _require_tenant_scope(self, user: User, salon_id: Optional[str]) -> str:
        tenant_id = self._resolve_tenant_scope(user, salon_id)
        if not tenant_id or tenant_id == "system":
            raise ResourceNotFoundException(
                "Salon context is required. Select a salon to load dashboard data."
            )
        return tenant_id

    async def get_dashboard(
        self,
        user: User,
        salon_id: Optional[str],
        merged_permissions: Dict[str, bool],
    ) -> DashboardResponse:
        role_view = self._resolve_role_view(user.role)
        if role_view == "super_admin":
            dashboard = await self._build_super_admin_dashboard(
                user, merged_permissions, salon_id=salon_id
            )
            dashboard.kpis.extend(await self._notification_kpis(user, salon_id, role_view))
            return dashboard
        if role_view == "admin":
            tenant_id = self._require_tenant_scope(user, salon_id)
            dashboard = await self._build_admin_dashboard(
                user, tenant_id, merged_permissions
            )
            dashboard.kpis.extend(await self._notification_kpis(user, tenant_id, role_view))
            return dashboard
        if role_view == "manager":
            tenant_id = self._require_tenant_scope(user, salon_id)
            dashboard = await self._build_manager_dashboard(
                user, tenant_id, merged_permissions
            )
            dashboard.kpis.extend(await self._notification_kpis(user, tenant_id, role_view))
            return dashboard
        tenant_id = self._require_tenant_scope(user, salon_id)
        dashboard = await self._build_staff_dashboard(user, tenant_id, merged_permissions)
        dashboard.kpis.extend(await self._notification_kpis(user, tenant_id, role_view))
        return dashboard

    async def _notification_kpis(
        self,
        user: User,
        tenant_id: Optional[str],
        role_view: DashboardRoleView,
    ) -> List[DashboardKpi]:
        query: Dict[str, Any] = {"is_deleted": False, "is_read": False}
        if role_view == "staff":
            query["recipient_id"] = str(user.id)
        elif tenant_id and tenant_id != "system":
            query["tenant_id"] = tenant_id
        unread = await Notification.find(query).count()
        kpis = [
            DashboardKpi(
                key="unread_notifications",
                label="Unread Notifications" if role_view != "staff" else "Personal Notifications",
                value=str(unread),
                tone="amber",
            )
        ]
        if role_view in ("super_admin", "admin", "manager"):
            alert_query: Dict[str, Any] = {"is_deleted": False, "status": "OPEN"}
            if tenant_id and tenant_id != "system":
                alert_query["tenant_id"] = tenant_id
            kpis.append(
                DashboardKpi(
                    key="business_alerts",
                    label="Business Alerts",
                    value=str(await BusinessAlert.find(alert_query).count()),
                    tone="purple",
                )
            )
        if role_view in ("super_admin", "admin"):
            subscription_query: Dict[str, Any] = {"is_deleted": False, "status": "OPEN"}
            if tenant_id and tenant_id != "system":
                subscription_query["tenant_id"] = tenant_id
            kpis.append(
                DashboardKpi(
                    key="subscription_alerts",
                    label="Subscription Alerts",
                    value=str(await SubscriptionNotification.find(subscription_query).count()),
                    tone="gold",
                )
            )
        return kpis

    async def _build_super_admin_dashboard(
        self,
        user: User,
        merged_permissions: Dict[str, bool],
        salon_id: Optional[str] = None,
    ) -> DashboardResponse:
        today = now_utc()
        today_start, today_end = self._day_range(today)
        month_start, month_end = self._month_range(today.month, today.year)

        tenants = await Tenant.find(Tenant.is_deleted == False).to_list()
        total_salons = len(tenants)
        active_salons = sum(1 for tenant in tenants if tenant.is_active)

        users = await User.find(User.is_deleted == False).to_list()
        total_users = len(users)
        total_staff = sum(
            1 for entry in users if normalize_role(entry.role) in STAFF_ROLES
        )

        invoice_query = {"is_deleted": False, "status": {"$ne": "VOIDED"}}
        all_invoices = await Invoice.find(invoice_query).to_list()

        today_revenue = sum(
            inv.total_amount
            for inv in all_invoices
            if inv.created_at
            and today_start <= self._ensure_utc(inv.created_at) < today_end
        )
        monthly_revenue = sum(
            inv.total_amount
            for inv in all_invoices
            if inv.created_at
            and month_start <= self._ensure_utc(inv.created_at) < month_end
        )

        appointments_today = await Appointment.find(
            {
                "is_deleted": False,
                "start_datetime": {"$gte": today_start, "$lt": today_end},
            }
        ).to_list()
        active_appointments = sum(
            1
            for apt in appointments_today
            if apt.status in ACTIVE_APPOINTMENT_STATUSES
        )

        inventory_alerts = await self._count_low_stock_items()

        pending_leave_count = 0
        if self._can_approve_leave(user.role, merged_permissions):
            scope_tenant = (
                salon_id
                or tenant_context.get_tenant_id()
                or None
            )
            pending_leave_count = await self._count_pending_leave_requests(
                scope_tenant if scope_tenant and scope_tenant != "system" else None
            )

        sub_stats = await self._subscription_service.get_dashboard_stats()
        pending_renewals = sub_stats.get("upcoming_expirations", 0)
        expiring_plans = sub_stats.get("total_expired", 0)
        failed_payments = sub_stats.get("total_suspended", 0)

        kpis = [
            DashboardKpi(
                key="total_salons",
                label="Total Salons",
                value=str(total_salons),
                tone="blue",
            ),
            DashboardKpi(
                key="active_salons",
                label="Active Salons",
                value=str(active_salons),
                tone="emerald",
            ),
            DashboardKpi(
                key="total_users",
                label="Total Users",
                value=str(total_users),
                tone="purple",
            ),
            DashboardKpi(
                key="total_staff",
                label="Total Staff",
                value=str(total_staff),
                tone="gold",
            ),
            DashboardKpi(
                key="today_revenue",
                label="Today's Revenue (All Salons)",
                value=self._format_currency(today_revenue),
                tone="emerald",
            ),
            DashboardKpi(
                key="monthly_revenue",
                label="Monthly Revenue",
                value=self._format_currency(monthly_revenue),
                tone="emerald",
            ),
            DashboardKpi(
                key="active_appointments",
                label="Active Appointments",
                value=str(active_appointments),
                sub=f"{len(appointments_today)} today",
                tone="blue",
            ),
            DashboardKpi(
                key="inventory_alerts",
                label="Inventory Alerts",
                value=str(inventory_alerts),
                tone="amber",
            ),
        ]

        if self._can_approve_leave(user.role, merged_permissions):
            kpis.append(
                DashboardKpi(
                    key="pending_leave_requests",
                    label="Pending Leave Requests",
                    value=str(pending_leave_count),
                    tone="amber",
                )
            )

        revenue_trend = await self._revenue_trend(all_invoices, today, days=7)
        appointment_trend = await self._appointment_trend_global(today, days=7)
        top_salons = await self._top_salons(all_invoices, tenants, month_start, month_end)
        top_services = await self._top_services(all_invoices, month_start, month_end)
        top_staff = await self._top_staff(all_invoices, today_start, today_end)

        operations = [
            DashboardOperation(
                key="pending_renewals",
                label="Pending Subscription Renewals",
                value=str(pending_renewals),
            ),
            DashboardOperation(
                key="expiring_plans",
                label="Expiring Plans",
                value=str(expiring_plans),
            ),
            DashboardOperation(
                key="low_stock",
                label="Low Stock Alerts",
                value=str(inventory_alerts),
            ),
            DashboardOperation(
                key="failed_payments",
                label="Failed Payments",
                value=str(failed_payments),
            ),
        ]

        if self._can_approve_leave(user.role, merged_permissions):
            operations.append(
                DashboardOperation(
                    key="pending_leave_requests",
                    label="Pending Leave Requests",
                    value=str(pending_leave_count),
                )
            )

        alerts: List[DashboardAlert] = []
        if pending_renewals:
            alerts.append(
                DashboardAlert(
                    key="renewals",
                    title="Subscription Renewals Due",
                    message=f"{pending_renewals} salon(s) have subscriptions expiring within 7 days.",
                    severity="warning",
                )
            )
        if inventory_alerts:
            alerts.append(
                DashboardAlert(
                    key="inventory",
                    title="Platform Inventory Alerts",
                    message=f"{inventory_alerts} product(s) are low or critical across salons.",
                    severity="error",
                )
            )

        quick_actions = self._quick_actions_for_role(
            user.role, merged_permissions, role_view="super_admin"
        )

        return DashboardResponse(
            role_view="super_admin",
            subtitle="Platform overview across all salons.",
            kpis=kpis,
            quick_actions=quick_actions,
            revenue_trend=revenue_trend,
            appointment_trend=appointment_trend,
            top_salons=top_salons,
            top_services=top_services,
            top_staff=top_staff,
            operations=operations,
            alerts=alerts,
        )

    async def _build_admin_dashboard(
        self,
        user: User,
        tenant_id: str,
        merged_permissions: Dict[str, bool],
    ) -> DashboardResponse:
        today = now_utc()
        today_start, today_end = self._day_range(today)
        month_start, month_end = self._month_range(today.month, today.year)
        base_query = {"tenant_id": tenant_id, "is_deleted": False}

        invoices = await Invoice.find(
            {**base_query, "status": {"$ne": "VOIDED"}}
        ).to_list()
        today_revenue = sum(
            inv.total_amount
            for inv in invoices
            if inv.created_at
            and today_start <= self._ensure_utc(inv.created_at) < today_end
        )
        monthly_revenue = sum(
            inv.total_amount
            for inv in invoices
            if inv.created_at
            and month_start <= self._ensure_utc(inv.created_at) < month_end
        )

        appointments = await Appointment.find(
            {
                **base_query,
                "start_datetime": {"$gte": today_start, "$lt": today_end},
            }
        ).to_list()
        appointments_today = len(appointments)
        completed_today = sum(
            1 for apt in appointments if apt.status in COMPLETED_APPOINTMENT_STATUSES
        )
        walk_ins = sum(1 for apt in appointments if apt.booking_source == "WALK_IN")

        customers = await Customer.find(base_query).to_list()
        active_cutoff = today - timedelta(days=90)
        active_clients = sum(
            1
            for customer in customers
            if customer.last_visit_at
            and self._ensure_utc(customer.last_visit_at) >= active_cutoff
        )

        attendance_summary = None
        staff_present = 0
        if self._can_view_attendance(user.role, merged_permissions):
            summary = await self._attendance_service.get_attendance_summary(
                user,
                date_from=today.strftime("%Y-%m-%d"),
                date_to=today.strftime("%Y-%m-%d"),
                salon_id=tenant_id,
            )
            staff_present = summary.present_count + summary.late_count
            attendance_summary = AttendanceSnapshot(
                present_count=summary.present_count,
                late_count=summary.late_count,
                absent_count=summary.absent_count,
                leave_count=summary.leave_count,
                total_staff=summary.total_records,
            )

        low_stock = 0
        if self._can_view_inventory(user.role, merged_permissions):
            low_stock = await self._count_low_stock_for_tenant(tenant_id)

        pending_payments = sum(
            1
            for inv in invoices
            if inv.payment_status == "PENDING"
            and inv.created_at
            and month_start <= self._ensure_utc(inv.created_at) < month_end
        )

        pending_leave_count = 0
        if self._can_approve_leave(user.role, merged_permissions):
            pending_leave_count = await self._count_pending_leave_requests(tenant_id)

        kpis = [
            DashboardKpi(
                key="today_revenue",
                label="Today's Revenue",
                value=self._format_currency(today_revenue),
                tone="emerald",
            ),
            DashboardKpi(
                key="monthly_revenue",
                label="Monthly Revenue",
                value=self._format_currency(monthly_revenue),
                tone="emerald",
            ),
            DashboardKpi(
                key="appointments_today",
                label="Appointments Today",
                value=str(appointments_today),
                tone="blue",
            ),
            DashboardKpi(
                key="completed_appointments",
                label="Completed Appointments",
                value=str(completed_today),
                tone="blue",
            ),
            DashboardKpi(
                key="walk_ins",
                label="Walk-ins",
                value=str(walk_ins),
                tone="purple",
            ),
            DashboardKpi(
                key="active_clients",
                label="Active Clients",
                value=str(active_clients),
                tone="purple",
            ),
            DashboardKpi(
                key="staff_present",
                label="Staff Present",
                value=str(staff_present),
                tone="gold",
            ),
            DashboardKpi(
                key="low_stock",
                label="Low Stock Items",
                value=str(low_stock),
                tone="amber",
            ),
        ]

        if self._can_approve_leave(user.role, merged_permissions):
            kpis.append(
                DashboardKpi(
                    key="pending_leave_requests",
                    label="Pending Leave Requests",
                    value=str(pending_leave_count),
                    tone="amber",
                )
            )

        upcoming = await self._upcoming_appointments(appointments)
        revenue_trend = await self._revenue_trend(invoices, today, days=7)
        appointment_trend = await self._appointment_trend_tenant(
            tenant_id, today, days=7
        )
        top_staff = await self._top_staff(invoices, today_start, today_end)
        top_services = await self._top_services(invoices, month_start, month_end)

        operations: List[DashboardOperation] = [
            DashboardOperation(
                key="pending_payments",
                label="Pending Payments",
                value=str(pending_payments),
            ),
        ]
        if self._can_view_inventory(user.role, merged_permissions):
            operations.append(
                DashboardOperation(
                    key="inventory_alerts",
                    label="Inventory Alerts",
                    value=str(low_stock),
                )
            )
        if attendance_summary:
            operations.append(
                DashboardOperation(
                    key="attendance_summary",
                    label="Attendance Summary",
                    value=f"{attendance_summary.present_count} present",
                    sub=f"{attendance_summary.absent_count} absent",
                )
            )
        if self._can_approve_leave(user.role, merged_permissions):
            operations.append(
                DashboardOperation(
                    key="pending_leave_requests",
                    label="Pending Leave Requests",
                    value=str(pending_leave_count),
                )
            )

        alerts = await self._inventory_alerts_for_tenant(tenant_id, low_stock)

        return DashboardResponse(
            role_view="admin",
            subtitle="Complete salon overview for today.",
            kpis=kpis,
            quick_actions=self._quick_actions_for_role(
                user.role, merged_permissions, role_view="admin"
            ),
            revenue_trend=revenue_trend,
            appointment_trend=appointment_trend,
            upcoming_appointments=upcoming,
            top_staff=top_staff,
            top_services=top_services,
            operations=operations,
            alerts=alerts,
            attendance_summary=attendance_summary,
        )

    async def _build_manager_dashboard(
        self,
        user: User,
        tenant_id: str,
        merged_permissions: Dict[str, bool],
    ) -> DashboardResponse:
        today = now_utc()
        today_start, today_end = self._day_range(today)
        base_query = {"tenant_id": tenant_id, "is_deleted": False}

        appointments = await Appointment.find(
            {
                **base_query,
                "start_datetime": {"$gte": today_start, "$lt": today_end},
            }
        ).to_list()
        appointments_today = len(appointments)
        completed_today = sum(
            1 for apt in appointments if apt.status in COMPLETED_APPOINTMENT_STATUSES
        )
        pending_services = sum(
            1
            for apt in appointments
            if apt.status in {"CHECKED_IN", "IN_PROGRESS", "CONFIRMED"}
        )

        kpis: List[DashboardKpi] = [
            DashboardKpi(
                key="appointments_today",
                label="Today's Appointments",
                value=str(appointments_today),
                tone="blue",
            ),
            DashboardKpi(
                key="completed_appointments",
                label="Completed Appointments",
                value=str(completed_today),
                tone="blue",
            ),
        ]

        invoices: List[Invoice] = []
        if self._can_view_billing(user.role, merged_permissions):
            invoices = await Invoice.find(
                {**base_query, "status": {"$ne": "VOIDED"}}
            ).to_list()
            today_revenue = sum(
                inv.total_amount
                for inv in invoices
                if inv.created_at
                and today_start <= self._ensure_utc(inv.created_at) < today_end
            )
            kpis.append(
                DashboardKpi(
                    key="today_revenue",
                    label="Revenue",
                    value=self._format_currency(today_revenue),
                    tone="emerald",
                )
            )

        attendance_summary = None
        if self._can_view_attendance(user.role, merged_permissions):
            summary = await self._attendance_service.get_attendance_summary(
                user,
                date_from=today.strftime("%Y-%m-%d"),
                date_to=today.strftime("%Y-%m-%d"),
                salon_id=tenant_id,
            )
            attendance_summary = AttendanceSnapshot(
                present_count=summary.present_count,
                late_count=summary.late_count,
                absent_count=summary.absent_count,
                leave_count=summary.leave_count,
                total_staff=summary.total_records,
            )
            kpis.append(
                DashboardKpi(
                    key="staff_attendance",
                    label="Staff Attendance",
                    value=str(summary.present_count + summary.late_count),
                    sub=f"{summary.absent_count} absent",
                    tone="gold",
                )
            )

        kpis.append(
            DashboardKpi(
                key="pending_services",
                label="Pending Services",
                value=str(pending_services),
                tone="amber",
            )
        )

        upcoming = await self._upcoming_appointments(appointments)
        month_start, month_end = self._month_range(today.month, today.year)

        revenue_trend: List[TrendPoint] = []
        top_services: List[PerformanceItem] = []
        top_staff: List[PerformanceItem] = []
        if invoices:
            revenue_trend = await self._revenue_trend(invoices, today, days=7)
            top_services = await self._top_services(invoices, month_start, month_end)
            top_staff = await self._top_staff(invoices, today_start, today_end)

        operations: List[DashboardOperation] = []
        alerts: List[DashboardAlert] = []
        if self._can_view_inventory(user.role, merged_permissions):
            low_stock = await self._count_low_stock_for_tenant(tenant_id)
            operations.append(
                DashboardOperation(
                    key="low_stock",
                    label="Low Stock Alerts",
                    value=str(low_stock),
                )
            )
            alerts = await self._inventory_alerts_for_tenant(tenant_id, low_stock)

        return DashboardResponse(
            role_view="manager",
            subtitle="Salon operations overview.",
            kpis=kpis,
            quick_actions=self._quick_actions_for_role(
                user.role, merged_permissions, role_view="manager"
            ),
            revenue_trend=revenue_trend,
            appointment_trend=await self._appointment_trend_tenant(
                tenant_id, today, days=7
            ),
            upcoming_appointments=upcoming,
            top_staff=top_staff,
            top_services=top_services,
            operations=operations,
            alerts=alerts,
            attendance_summary=attendance_summary,
        )

    async def _build_staff_dashboard(
        self,
        user: User,
        tenant_id: str,
        merged_permissions: Dict[str, bool],
    ) -> DashboardResponse:
        today = now_utc()
        today_start, today_end = self._day_range(today)
        staff_id = str(user.id)

        appointments = await Appointment.find(
            {
                "tenant_id": tenant_id,
                "staff_id": staff_id,
                "is_deleted": False,
                "start_datetime": {"$gte": today_start, "$lt": today_end},
            }
        ).to_list()
        appointments_today = len(appointments)
        completed_today = sum(
            1 for apt in appointments if apt.status in COMPLETED_APPOINTMENT_STATUSES
        )

        earnings = await self._earnings_service.get_summary(user)
        assigned_clients = earnings.completed_appointments_count
        incentives_earned = earnings.today_incentives

        attendance_status = await self._attendance_service.get_today_status(user)
        staff_attendance = StaffAttendanceStatus(
            status=attendance_status.status,
            is_checked_in=attendance_status.is_checked_in,
            is_checked_out=attendance_status.is_checked_out,
            total_hours=attendance_status.total_hours,
        )

        kpis = [
            DashboardKpi(
                key="appointments_today",
                label="Today's Appointments",
                value=str(appointments_today),
                tone="blue",
            ),
            DashboardKpi(
                key="completed_services",
                label="Completed Services",
                value=str(completed_today),
                tone="blue",
            ),
            DashboardKpi(
                key="assigned_clients",
                label="Assigned Clients",
                value=str(assigned_clients),
                tone="purple",
            ),
            DashboardKpi(
                key="incentives_earned",
                label="Incentives Earned",
                value=self._format_currency(incentives_earned),
                tone="emerald",
            ),
            DashboardKpi(
                key="attendance_status",
                label="Attendance Status",
                value=(attendance_status.status or "Not Marked").replace("_", " ").title(),
                sub=(
                    f"{attendance_status.total_hours:.1f}h logged"
                    if attendance_status.total_hours
                    else None
                ),
                tone="gold",
            ),
        ]

        upcoming = await self._upcoming_appointments(
            appointments, staff_name=self._staff_name(user)
        )
        performance = StaffPerformanceMetrics(
            monthly_services=earnings.completed_appointments_count,
            target_progress_percent=earnings.target_progress_percent,
        )

        return DashboardResponse(
            role_view="staff",
            subtitle="Your personal schedule and performance for today.",
            kpis=kpis,
            quick_actions=self._quick_actions_for_role(
                user.role, merged_permissions, role_view="staff"
            ),
            upcoming_appointments=upcoming,
            staff_attendance=staff_attendance,
            performance=performance,
        )

    def _quick_actions_for_role(
        self,
        role: str,
        merged_permissions: Dict[str, bool],
        role_view: DashboardRoleView,
    ) -> List[DashboardQuickAction]:
        catalog: Dict[str, tuple[str, Module]] = {
            "create_salon": ("Create Salon", Module.SALON_MANAGEMENT),
            "create_admin": ("Create Admin", Module.USER_MANAGEMENT),
            "manage_subscription": ("Manage Subscription", Module.SUBSCRIPTION_MANAGEMENT),
            "view_analytics": ("View Analytics", Module.CUSTOMER_ANALYTICS),
            "manage_plans": ("Manage Plans", Module.SUBSCRIPTION_MANAGEMENT),
            "create_appointment": ("Create Appointment", Module.APPOINTMENTS),
            "create_bill": ("Create Bill", Module.BILLING_FINANCE),
            "add_customer": ("Add Customer", Module.CUSTOMER_ANALYTICS),
            "add_product": ("Add Product", Module.PRODUCTS_INVENTORY),
            "add_staff": ("Add Staff", Module.EMPLOYEES),
            "view_reports": ("View Reports", Module.BILLING_FINANCE),
            "check_in_customer": ("Check-in Customer", Module.APPOINTMENTS),
            "attendance": ("Attendance", Module.ATTENDANCE),
            "inventory_request": ("Inventory Request", Module.PRODUCTS_INVENTORY),
            "check_in": ("Check In", Module.ATTENDANCE),
            "check_out": ("Check Out", Module.ATTENDANCE),
            "view_schedule": ("View Schedule", Module.APPOINTMENTS),
            "my_customers": ("My Customers", Module.APPOINTMENTS),
            "my_performance": ("My Performance", Module.MY_EARNINGS),
        }

        keys_by_view: Dict[DashboardRoleView, List[str]] = {
            "super_admin": [
                "create_salon",
                "create_admin",
                "manage_subscription",
                "view_analytics",
                "manage_plans",
            ],
            "admin": [
                "create_appointment",
                "create_bill",
                "add_customer",
                "add_product",
                "add_staff",
                "view_reports",
            ],
            "manager": [
                "create_appointment",
                "check_in_customer",
                "create_bill",
                "attendance",
                "inventory_request",
            ],
            "staff": [
                "check_in",
                "check_out",
                "view_schedule",
                "my_customers",
                "my_performance",
            ],
        }

        actions: List[DashboardQuickAction] = []
        for key in keys_by_view.get(role_view, []):
            label, module = catalog[key]
            if key in {"create_bill", "view_reports"}:
                if not (
                    self._can_view_billing(role, merged_permissions)
                    or can_access_permission(role, BILLING_BILLS, merged_permissions)
                ):
                    continue
            elif not self._can_access_module(role, module, merged_permissions):
                continue
            actions.append(
                DashboardQuickAction(key=key, label=label, module=module.value)
            )
        return actions

    @staticmethod
    def _ensure_utc(dt: datetime) -> datetime:
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc)

    @staticmethod
    def _staff_name(user: User) -> str:
        parts = [user.first_name or "", user.last_name or ""]
        name = " ".join(part for part in parts if part).strip()
        return name or user.email

    async def _upcoming_appointments(
        self,
        appointments: List[Appointment],
        staff_name: Optional[str] = None,
        limit: int = 8,
    ) -> List[DashboardAppointmentItem]:
        sorted_apts = sorted(appointments, key=lambda apt: apt.start_datetime)
        customer_ids = list(
            dict.fromkeys(apt.customer_id for apt in sorted_apts if apt.customer_id)
        )
        customer_names: Dict[str, str] = {}
        if customer_ids:
            object_ids = []
            for customer_id in customer_ids:
                try:
                    object_ids.append(PydanticObjectId(customer_id))
                except Exception:
                    continue
            if object_ids:
                customers = await Customer.find(
                    {"_id": {"$in": object_ids}, "is_deleted": False}
                ).to_list()
                for customer in customers:
                    customer_names[str(customer.id)] = customer.full_name.strip()

        items: List[DashboardAppointmentItem] = []
        for apt in sorted_apts[:limit]:
            if apt.status in {"CANCELLED", "NO_SHOW"}:
                continue
            service_names = [service.name for service in apt.services]
            service_summary = ", ".join(service_names) if service_names else "Service"
            stylist = staff_name
            if not stylist and apt.services:
                stylist = apt.services[0].staff_name or "Staff"
            if not stylist:
                stylist = "Staff"
            items.append(
                DashboardAppointmentItem(
                    id=str(apt.id),
                    time=self._format_time(apt.start_datetime),
                    client_name=customer_names.get(apt.customer_id, "Client"),
                    service_summary=service_summary,
                    staff_name=stylist,
                    status=apt.status.replace("_", " ").title(),
                )
            )
        return items

    async def _revenue_trend(
        self,
        invoices: List[Invoice],
        today: datetime,
        days: int = 7,
    ) -> List[TrendPoint]:
        points: List[TrendPoint] = []
        for offset in range(days - 1, -1, -1):
            day = today - timedelta(days=offset)
            start, end = self._day_range(day)
            total = sum(
                inv.total_amount
                for inv in invoices
                if inv.created_at
                and start <= self._ensure_utc(inv.created_at) < end
            )
            points.append(
                TrendPoint(label=day.strftime("%d/%m"), value=round(total, 2))
            )
        return points

    async def _appointment_trend_tenant(
        self, tenant_id: str, today: datetime, days: int = 7
    ) -> List[TrendPoint]:
        points: List[TrendPoint] = []
        for offset in range(days - 1, -1, -1):
            day = today - timedelta(days=offset)
            start, end = self._day_range(day)
            count = await Appointment.find(
                {
                    "tenant_id": tenant_id,
                    "is_deleted": False,
                    "start_datetime": {"$gte": start, "$lt": end},
                }
            ).count()
            points.append(TrendPoint(label=day.strftime("%d/%m"), value=float(count)))
        return points

    async def _appointment_trend_global(
        self, today: datetime, days: int = 7
    ) -> List[TrendPoint]:
        points: List[TrendPoint] = []
        for offset in range(days - 1, -1, -1):
            day = today - timedelta(days=offset)
            start, end = self._day_range(day)
            count = await Appointment.find(
                {
                    "is_deleted": False,
                    "start_datetime": {"$gte": start, "$lt": end},
                }
            ).count()
            points.append(TrendPoint(label=day.strftime("%d/%m"), value=float(count)))
        return points

    async def _top_staff(
        self,
        invoices: List[Invoice],
        start: datetime,
        end: datetime,
        limit: int = 5,
    ) -> List[PerformanceItem]:
        totals: Dict[str, Dict[str, Any]] = defaultdict(
            lambda: {"name": "Staff", "amount": 0.0}
        )
        for invoice in invoices:
            if not invoice.created_at:
                continue
            created = self._ensure_utc(invoice.created_at)
            if not (start <= created < end):
                continue
            for item in invoice.items:
                staff_key = item.staff_id or item.staff_name or "unknown"
                name = item.staff_name or "Staff"
                totals[staff_key]["name"] = name
                totals[staff_key]["amount"] += item.total
        ranked = sorted(totals.values(), key=lambda row: row["amount"], reverse=True)
        return [
            PerformanceItem(
                id=str(index),
                name=row["name"],
                subtitle="Today",
                value=self._format_currency(row["amount"]),
            )
            for index, row in enumerate(ranked[:limit])
        ]

    async def _top_services(
        self,
        invoices: List[Invoice],
        start: datetime,
        end: datetime,
        limit: int = 5,
    ) -> List[PerformanceItem]:
        totals: Dict[str, float] = defaultdict(float)
        for invoice in invoices:
            if not invoice.created_at:
                continue
            created = self._ensure_utc(invoice.created_at)
            if not (start <= created < end):
                continue
            for item in invoice.items:
                if item.item_type != "SERVICE":
                    continue
                totals[item.name] += item.total
        ranked = sorted(totals.items(), key=lambda pair: pair[1], reverse=True)
        return [
            PerformanceItem(
                id=str(index),
                name=name,
                subtitle="This month",
                value=self._format_currency(amount),
            )
            for index, (name, amount) in enumerate(ranked[:limit])
        ]

    async def _top_salons(
        self,
        invoices: List[Invoice],
        tenants: List[Tenant],
        start: datetime,
        end: datetime,
        limit: int = 5,
    ) -> List[PerformanceItem]:
        tenant_names = {str(tenant.id): tenant.name for tenant in tenants}
        totals: Dict[str, float] = defaultdict(float)
        for invoice in invoices:
            if not invoice.created_at or not invoice.tenant_id:
                continue
            created = self._ensure_utc(invoice.created_at)
            if not (start <= created < end):
                continue
            totals[invoice.tenant_id] += invoice.total_amount
        ranked = sorted(totals.items(), key=lambda pair: pair[1], reverse=True)
        return [
            PerformanceItem(
                id=tenant_id,
                name=tenant_names.get(tenant_id, "Salon"),
                subtitle="This month",
                value=self._format_currency(amount),
            )
            for tenant_id, amount in ranked[:limit]
        ]

    async def _count_low_stock_items(self) -> int:
        stocks = await ProductInventory.find({"is_deleted": False}).to_list()
        return sum(
            1
            for item in stocks
            if item.min_threshold
            and item.stock_quantity <= item.min_threshold
        )

    async def _count_low_stock_for_tenant(self, tenant_id: str) -> int:
        try:
            overview = await self._inventory_service.overview(tenant_id)
            return len(overview.warnings)
        except Exception:
            return 0

    async def _inventory_alerts_for_tenant(
        self, tenant_id: str, low_stock: int
    ) -> List[DashboardAlert]:
        if low_stock <= 0:
            return []
        try:
            overview = await self._inventory_service.overview(tenant_id)
            names = ", ".join(
                warning.get("product_name", "Product") for warning in overview.warnings[:3]
            )
            suffix = "..." if len(overview.warnings) > 3 else ""
            return [
                DashboardAlert(
                    key="low_stock",
                    title="Low Stock Alert",
                    message=f"{names}{suffix}",
                    severity="error",
                )
            ]
        except Exception:
            return [
                DashboardAlert(
                    key="low_stock",
                    title="Low Stock Alert",
                    message=f"{low_stock} product(s) need attention.",
                    severity="warning",
                )
            ]
