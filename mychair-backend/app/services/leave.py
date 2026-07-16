import logging
import math
from datetime import timedelta
from typing import Any, Dict, List, Optional

from beanie import PydanticObjectId

from app.auth.rbac_config import (
    ROLE_EMPLOYEE,
    ROLE_SALON_ADMIN,
    ROLE_SALON_MANAGER,
    ROLE_SALON_OWNER,
    ROLE_SUPER_ADMIN,
    normalize_role,
)
from app.constants.attendance_options import (
    ATTENDANCE_LOG_AUTO_ABSENT,
    ATTENDANCE_METHOD_MANUAL,
    ATTENDANCE_SOURCE_AUTO_ABSENT,
    ATTENDANCE_SOURCE_LEAVE,
    ATTENDANCE_STATUS_ABSENT,
    ATTENDANCE_STATUS_LEAVE,
    SYSTEM_ACTOR_ID,
)
from app.constants.leave_options import (
    LEAVE_LOG_APPROVED,
    LEAVE_LOG_CREATED,
    LEAVE_LOG_REJECTED,
    LEAVE_STATUS_APPROVED,
    LEAVE_STATUS_PENDING,
    LEAVE_STATUS_REJECTED,
)
from app.core.exceptions import (
    BookingConflictException,
    PermissionDeniedException,
    ResourceNotFoundException,
    SalonERPException,
)
from app.models.attendance import Attendance
from app.models.attendance_log import AttendanceLog
from app.models.leave_log import LeaveLog
from app.models.leave_request import LeaveRequest
from app.models.user import User
from app.repositories.attendance import AttendanceRepository
from app.repositories.leave import LeaveRepository
from app.utils.timezone import now_utc
from app.utils.week_off import is_week_off_day
from fastapi import status


class LeaveService:
    """Business logic for leave requests and approval workflow."""

    ATTENDANCE_CONFLICT_STATUSES = {"PRESENT", "LATE", "HALF_DAY"}

    def __init__(self) -> None:
        self.logger = logging.getLogger(__name__)
        self.repo = LeaveRepository()
        self.attendance_repo = AttendanceRepository()

    @staticmethod
    def _resolve_salon_id(actor: User) -> str:
        from app.core import tenant_context

        salon_id = tenant_context.get_tenant_id() or actor.tenant_id
        if not salon_id or salon_id == "system":
            raise PermissionDeniedException(
                detail="No salon associated with your account"
            )
        return salon_id

    @staticmethod
    def _full_name(user: User) -> str:
        parts = [user.first_name or "", user.last_name or ""]
        name = " ".join(p for p in parts if p).strip()
        return name or user.email

    async def _write_log(
        self,
        leave_request_id: str,
        action_type: str,
        action_by: str,
        old_value: Optional[str],
        new_value: Optional[str],
        tenant_id: str,
    ) -> None:
        log = LeaveLog(
            tenant_id=tenant_id,
            leave_request_id=leave_request_id,
            action_type=action_type,
            action_by=action_by,
            old_value=old_value,
            new_value=new_value,
        )
        await log.insert()

    async def _approver_name(self, approver_id: Optional[str]) -> Optional[str]:
        if not approver_id:
            return None
        try:
            user = await User.get(approver_id)
            return self._full_name(user) if user else None
        except Exception:
            return None

    def _to_item(self, record: LeaveRequest) -> "LeaveItem":
        from app.schemas.leave import LeaveItem

        return LeaveItem(
            id=str(record.id),
            salon_id=record.salon_id,
            employee_id=record.employee_id,
            employee_name=record.employee_name,
            employee_role=record.employee_role,
            leave_date=record.leave_date,
            leave_reason=record.leave_reason,
            status=record.status,
            approved_by=record.approved_by,
            approved_at=record.approved_at,
            rejection_reason=record.rejection_reason,
            created_at=record.created_at,
            updated_at=record.updated_at,
        )

    async def _to_item_with_names(self, record: LeaveRequest) -> "LeaveItem":
        item = self._to_item(record)
        item.approved_by_name = await self._approver_name(record.approved_by)
        return item

    def _can_approve(self, actor: User) -> bool:
        role = normalize_role(actor.role)
        return role in {ROLE_SUPER_ADMIN, ROLE_SALON_OWNER}

    async def apply_leave(self, actor: User, leave_date: str, leave_reason: str) -> "LeaveItem":
        salon_id = self._resolve_salon_id(actor)
        staff_id = str(actor.id)

        existing_leave = await self.repo.get_by_employee_and_date(
            salon_id, staff_id, leave_date
        )
        if existing_leave:
            raise BookingConflictException(
                detail="A leave request already exists for this date"
            )

        attendance = await self.attendance_repo.get_by_employee_and_date(
            salon_id, staff_id, leave_date
        )
        if attendance and attendance.status in self.ATTENDANCE_CONFLICT_STATUSES:
            raise BookingConflictException(
                detail="Cannot apply leave — attendance already marked for this date"
            )

        record = LeaveRequest(
            tenant_id=salon_id,
            salon_id=salon_id,
            employee_id=staff_id,
            employee_name=self._full_name(actor),
            employee_role=actor.role or ROLE_EMPLOYEE,
            leave_date=leave_date,
            leave_reason=leave_reason.strip(),
            status=LEAVE_STATUS_PENDING,
            created_by=staff_id,
            updated_by=staff_id,
        )
        await record.insert()

        await self._write_log(
            str(record.id),
            LEAVE_LOG_CREATED,
            staff_id,
            None,
            f"date={leave_date},status={LEAVE_STATUS_PENDING}",
            salon_id,
        )
        return await self._to_item_with_names(record)

    async def approve_leave(self, actor: User, leave_id: str) -> "LeaveItem":
        if not self._can_approve(actor):
            raise PermissionDeniedException(detail="You are not allowed to approve leave")

        salon_id = self._resolve_salon_id(actor)
        record = await self._get_leave_in_scope(actor, leave_id, salon_id)

        if record.status != LEAVE_STATUS_PENDING:
            raise SalonERPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only pending leave requests can be approved",
            )

        old_status = record.status
        now = now_utc()
        record.status = LEAVE_STATUS_APPROVED
        record.approved_by = str(actor.id)
        record.approved_at = now
        record.updated_by = str(actor.id)
        await record.save()

        await self._write_log(
            str(record.id),
            LEAVE_LOG_APPROVED,
            str(actor.id),
            old_status,
            LEAVE_STATUS_APPROVED,
            salon_id,
        )
        await self._ensure_leave_attendance(record)
        return await self._to_item_with_names(record)

    async def reject_leave(
        self, actor: User, leave_id: str, rejection_reason: Optional[str] = None
    ) -> "LeaveItem":
        if not self._can_approve(actor):
            raise PermissionDeniedException(detail="You are not allowed to reject leave")

        salon_id = self._resolve_salon_id(actor)
        record = await self._get_leave_in_scope(actor, leave_id, salon_id)

        if record.status != LEAVE_STATUS_PENDING:
            raise SalonERPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Only pending leave requests can be rejected",
            )

        old_status = record.status
        record.status = LEAVE_STATUS_REJECTED
        record.rejection_reason = (rejection_reason or "").strip() or None
        record.approved_by = str(actor.id)
        record.approved_at = now_utc()
        record.updated_by = str(actor.id)
        await record.save()

        await self._write_log(
            str(record.id),
            LEAVE_LOG_REJECTED,
            str(actor.id),
            old_status,
            LEAVE_STATUS_REJECTED,
            salon_id,
        )
        return await self._to_item_with_names(record)

    async def _get_leave_in_scope(
        self, actor: User, leave_id: str, salon_id: str
    ) -> LeaveRequest:
        try:
            obj_id = PydanticObjectId(leave_id)
        except Exception as exc:
            raise ResourceNotFoundException(detail="Leave request not found") from exc

        record = await LeaveRequest.find_one({"_id": obj_id, "is_deleted": False})
        if not record:
            raise ResourceNotFoundException(detail="Leave request not found")

        role = normalize_role(actor.role)
        if role != ROLE_SUPER_ADMIN and record.tenant_id != salon_id:
            raise PermissionDeniedException()

        if role == ROLE_SALON_MANAGER:
            employee = await User.get(record.employee_id)
            if employee and actor.branch_id and employee.branch_id != actor.branch_id:
                raise PermissionDeniedException()

        return record

    async def _ensure_leave_attendance(self, leave: LeaveRequest) -> None:
        existing = await self.attendance_repo.get_by_employee_and_date(
            leave.tenant_id or leave.salon_id,
            leave.employee_id,
            leave.leave_date,
        )
        if existing:
            if existing.status not in {ATTENDANCE_STATUS_LEAVE, ATTENDANCE_STATUS_ABSENT}:
                return
            existing.status = ATTENDANCE_STATUS_LEAVE
            existing.source = ATTENDANCE_SOURCE_LEAVE
            existing.attendance_method = ATTENDANCE_METHOD_MANUAL
            existing.updated_by = SYSTEM_ACTOR_ID
            await existing.save()
            return

        employee = await User.get(leave.employee_id)
        record = Attendance(
            tenant_id=leave.tenant_id or leave.salon_id,
            salon_id=leave.salon_id,
            staff_id=leave.employee_id,
            branch_id=employee.branch_id if employee else None,
            date=leave.leave_date,
            status=ATTENDANCE_STATUS_LEAVE,
            attendance_method=ATTENDANCE_METHOD_MANUAL,
            source=ATTENDANCE_SOURCE_LEAVE,
            notes=f"Approved leave: {leave.leave_reason[:200]}",
            created_by=SYSTEM_ACTOR_ID,
            updated_by=SYSTEM_ACTOR_ID,
        )
        await record.insert()

    async def list_pending(
        self,
        actor: User,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        salon_id: Optional[str] = None,
    ) -> "PaginatedLeaveRequests":
        from app.schemas.leave import PaginatedLeaveRequests

        if not self._can_approve(actor):
            raise PermissionDeniedException()

        filters = await self._build_list_filters(actor, salon_id=salon_id, scope="all")
        filters["status"] = LEAVE_STATUS_PENDING

        items, total = await self.repo.list_paginated(
            filters,
            page=page,
            limit=limit,
            sort=["-created_at"],
        )

        if search:
            needle = search.lower()
            items = [
                item
                for item in items
                if needle in item.employee_name.lower()
                or needle in item.leave_reason.lower()
                or needle in item.leave_date
            ]
            total = len(items)

        start = (page - 1) * limit
        page_items = items[start : start + limit]
        pages = max(1, math.ceil(total / limit)) if total else 1

        result_items = [await self._to_item_with_names(item) for item in page_items]
        return PaginatedLeaveRequests(
            items=result_items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )

    async def list_leave_requests(
        self,
        actor: User,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        status: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        employee_id: Optional[str] = None,
        salon_id: Optional[str] = None,
        scope: str = "my",
        history_only: bool = False,
    ) -> "PaginatedLeaveRequests":
        from app.schemas.leave import PaginatedLeaveRequests

        filters = await self._build_list_filters(
            actor, salon_id=salon_id, scope=scope, employee_id=employee_id
        )
        if status:
            filters["status"] = status
        elif history_only:
            filters["status"] = {"$in": [LEAVE_STATUS_APPROVED, LEAVE_STATUS_REJECTED]}
        if date_from or date_to:
            date_filter: Dict[str, Any] = {}
            if date_from:
                date_filter["$gte"] = date_from
            if date_to:
                date_filter["$lte"] = date_to
            filters["leave_date"] = date_filter

        items, total = await self.repo.list_paginated(
            filters, page=page, limit=limit, sort=["-leave_date", "-created_at"]
        )

        if search:
            needle = search.lower()
            items = [
                item
                for item in items
                if needle in item.employee_name.lower()
                or needle in item.leave_reason.lower()
                or needle in item.leave_date
                or needle in (item.status or "").lower()
            ]
            total = len(items)

        pages = max(1, math.ceil(total / limit)) if total else 1
        result_items = [await self._to_item_with_names(item) for item in items]
        return PaginatedLeaveRequests(
            items=result_items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )

    async def _build_list_filters(
        self,
        actor: User,
        salon_id: Optional[str] = None,
        scope: str = "my",
        employee_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        role = normalize_role(actor.role)
        filters: Dict[str, Any] = {}

        if role == ROLE_EMPLOYEE:
            filters["tenant_id"] = self._resolve_salon_id(actor)
            filters["employee_id"] = str(actor.id)
        elif role == ROLE_SALON_MANAGER:
            filters["tenant_id"] = self._resolve_salon_id(actor)
            if scope == "my" or (scope == "team" and not employee_id):
                if scope == "my":
                    filters["employee_id"] = str(actor.id)
                else:
                    branch_filter = actor.branch_id
                    if branch_filter:
                        branch_staff = await User.find(
                            {
                                "tenant_id": filters["tenant_id"],
                                "branch_id": branch_filter,
                                "is_deleted": False,
                            }
                        ).to_list()
                        filters["employee_id"] = {
                            "$in": [str(u.id) for u in branch_staff]
                        }
                    elif actor.branch_name:
                        branch_staff = await User.find(
                            {
                                "tenant_id": filters["tenant_id"],
                                "branch_name": actor.branch_name,
                                "is_deleted": False,
                            }
                        ).to_list()
                        filters["employee_id"] = {
                            "$in": [str(u.id) for u in branch_staff]
                        }
            elif employee_id:
                filters["employee_id"] = employee_id
        elif role in {ROLE_SALON_OWNER, ROLE_SALON_ADMIN}:
            filters["tenant_id"] = self._resolve_salon_id(actor)
            if scope == "my":
                filters["employee_id"] = str(actor.id)
            elif employee_id:
                filters["employee_id"] = employee_id
        elif role == ROLE_SUPER_ADMIN:
            if salon_id:
                filters["tenant_id"] = salon_id
            if scope == "my":
                filters["employee_id"] = str(actor.id)
            elif employee_id:
                filters["employee_id"] = employee_id
        else:
            raise PermissionDeniedException()

        return filters

    async def get_approved_leave_for_date(
        self, tenant_id: str, employee_id: str, date_str: str
    ) -> Optional[LeaveRequest]:
        return await LeaveRequest.find_one(
            {
                "tenant_id": tenant_id,
                "employee_id": employee_id,
                "leave_date": date_str,
                "status": LEAVE_STATUS_APPROVED,
                "is_deleted": False,
            }
        )

    async def has_approved_leave_on_date(
        self, tenant_id: str, employee_id: str, date_str: str
    ) -> bool:
        leave = await self.get_approved_leave_for_date(tenant_id, employee_id, date_str)
        return leave is not None


class AttendanceReconciliationService:
    """Reconcile previous-day attendance without background workers."""

    STAFF_ROLES = [ROLE_SALON_MANAGER, ROLE_EMPLOYEE, ROLE_SALON_ADMIN]

    def __init__(self) -> None:
        self.logger = logging.getLogger(__name__)
        self.attendance_repo = AttendanceRepository()
        self.leave_service = LeaveService()

    @staticmethod
    def _previous_day() -> str:
        return (now_utc() - timedelta(days=1)).strftime("%Y-%m-%d")

    async def _write_attendance_log(
        self,
        attendance_id: str,
        action_type: str,
        tenant_id: str,
        new_value: str,
    ) -> None:
        log = AttendanceLog(
            tenant_id=tenant_id,
            attendance_id=attendance_id,
            action_type=action_type,
            action_by=SYSTEM_ACTOR_ID,
            old_value=None,
            new_value=new_value,
        )
        await log.insert()

    async def _create_system_attendance(
        self,
        tenant_id: str,
        user: User,
        date_str: str,
        status: str,
        source: str,
        notes: Optional[str] = None,
    ) -> Attendance:
        record = Attendance(
            tenant_id=tenant_id,
            salon_id=tenant_id,
            staff_id=str(user.id),
            branch_id=user.branch_id,
            date=date_str,
            status=status,
            attendance_method=ATTENDANCE_METHOD_MANUAL,
            source=source,
            notes=notes,
            created_by=SYSTEM_ACTOR_ID,
            updated_by=SYSTEM_ACTOR_ID,
        )
        await record.insert()
        action = (
            ATTENDANCE_LOG_AUTO_ABSENT
            if status == ATTENDANCE_STATUS_ABSENT
            else ATTENDANCE_LOG_STATUS_CHANGE
        )
        await self._write_attendance_log(
            str(record.id),
            action,
            tenant_id,
            f"status={status},source={source},date={date_str}",
        )
        return record

    async def reconcile_salon(self, salon_id: str) -> int:
        """Reconcile previous day for all active staff in a salon. Returns records created."""
        if not salon_id or salon_id == "system":
            return 0

        target_date = self._previous_day()
        staff = await User.find(
            {
                "tenant_id": salon_id,
                "is_deleted": False,
                "is_active": True,
                "role": {"$in": self.STAFF_ROLES},
            }
        ).to_list()

        created = 0
        for user in staff:
            staff_id = str(user.id)
            if is_week_off_day(user.weekly_off or [], target_date):
                continue

            existing = await self.attendance_repo.get_by_employee_and_date(
                salon_id, staff_id, target_date
            )
            if existing:
                continue

            approved_leave = await self.leave_service.get_approved_leave_for_date(
                salon_id, staff_id, target_date
            )
            if approved_leave:
                await self.leave_service._ensure_leave_attendance(approved_leave)
                created += 1
                continue

            await self._create_system_attendance(
                salon_id,
                user,
                target_date,
                ATTENDANCE_STATUS_ABSENT,
                ATTENDANCE_SOURCE_AUTO_ABSENT,
                notes="Auto-marked absent (no attendance recorded)",
            )
            created += 1

        return created

    async def reconcile_for_actor(self, actor: User, salon_id: Optional[str] = None) -> int:
        role = normalize_role(actor.role)
        if role == ROLE_SUPER_ADMIN:
            target_salon = salon_id or actor.tenant_id
            if not target_salon or target_salon == "system":
                from app.core import tenant_context

                target_salon = tenant_context.get_tenant_id()
            if not target_salon or target_salon == "system":
                return 0
            return await self.reconcile_salon(target_salon)

        resolved = LeaveService._resolve_salon_id(actor)
        return await self.reconcile_salon(resolved)
