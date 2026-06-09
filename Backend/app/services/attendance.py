import logging
import math
from calendar import monthrange
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

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
    ATTENDANCE_LOG_CHECK_IN,
    ATTENDANCE_LOG_CHECK_OUT,
    ATTENDANCE_LOG_MANUAL_UPDATE,
    ATTENDANCE_METHOD_LOCATION,
    ATTENDANCE_METHOD_MANUAL,
    ATTENDANCE_STATUS_ABSENT,
    ATTENDANCE_STATUS_HALF_DAY,
    ATTENDANCE_STATUS_LATE,
    ATTENDANCE_STATUS_PRESENT,
    ATTENDANCE_STATUS_WEEK_OFF,
    DEFAULT_ATTENDANCE_RADIUS_METERS,
    DEFAULT_SHIFT_START,
    HALF_DAY_THRESHOLD_MINUTES,
    LATE_GRACE_MINUTES,
)
from app.core import tenant_context
from app.core.exceptions import (
    BookingConflictException,
    PermissionDeniedException,
    ResourceNotFoundException,
    SalonERPException,
)
from app.models.attendance import Attendance
from app.models.attendance_log import AttendanceLog
from app.models.salon import Salon
from app.models.tenant import Tenant
from app.models.user import User
from app.repositories.attendance import AttendanceRepository
from app.schemas.attendance import (
    AttendanceItem,
    AttendanceSummary,
    BranchLocationResponse,
    BranchLocationUpdate,
    ManualAttendanceUpdate,
    PaginatedAttendance,
    TodayAttendanceStatus,
)
from app.utils.geo import is_within_radius, validate_coordinates
from app.utils.timezone import make_aware, now_utc
from app.utils.week_off import is_week_off_day, week_off_dates_in_range
from fastapi import status


class LocationOutsidePremisesException(SalonERPException):
    def __init__(self, detail: str = "You are outside salon premises") -> None:
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class AttendanceService:
    """Business logic for attendance check-in/out, listing, and manual corrections."""

    def __init__(self) -> None:
        self.logger = logging.getLogger(__name__)
        self.repo = AttendanceRepository()

    # ------------------------------------------------------------------ #
    # Scope helpers
    # ------------------------------------------------------------------ #
    def _resolve_salon_id(self, actor: User) -> str:
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
    def _today_date() -> str:
        return now_utc().strftime("%Y-%m-%d")

    def _location_required(self, actor: User) -> bool:
        role = normalize_role(actor.role)
        return role in {ROLE_EMPLOYEE, ROLE_SALON_MANAGER}

    def _can_skip_location(self, actor: User) -> bool:
        role = normalize_role(actor.role)
        return role in {ROLE_SUPER_ADMIN, ROLE_SALON_OWNER}

    async def _resolve_branch(
        self, actor: User, salon_id: str
    ) -> Tuple[Optional[str], Optional[float], Optional[float], int, str, str]:
        """
        Resolve branch coordinates and shift start.
        Returns: branch_id, lat, lon, radius, branch_name, shift_start
        """
        branch_id = actor.branch_id
        branch_name = actor.branch_name
        lat: Optional[float] = None
        lon: Optional[float] = None
        radius = DEFAULT_ATTENDANCE_RADIUS_METERS
        shift_start = DEFAULT_SHIFT_START

        tenant = await Tenant.get(salon_id)
        if tenant:
            shift_start = tenant.shift_start or DEFAULT_SHIFT_START
            if tenant.latitude is not None and tenant.longitude is not None:
                lat = tenant.latitude
                lon = tenant.longitude
                radius = tenant.attendance_radius or DEFAULT_ATTENDANCE_RADIUS_METERS

        if branch_id:
            salon_branch = await Salon.get(branch_id)
            if salon_branch and salon_branch.tenant_id == salon_id:
                branch_name = salon_branch.name
                if salon_branch.latitude is not None and salon_branch.longitude is not None:
                    lat = salon_branch.latitude
                    lon = salon_branch.longitude
                    radius = salon_branch.attendance_radius or DEFAULT_ATTENDANCE_RADIUS_METERS
        else:
            default_branch = await Salon.find_one(
                {"tenant_id": salon_id, "is_deleted": False, "is_active": True}
            )
            if default_branch:
                branch_id = str(default_branch.id)
                branch_name = default_branch.name
                if (
                    default_branch.latitude is not None
                    and default_branch.longitude is not None
                ):
                    lat = default_branch.latitude
                    lon = default_branch.longitude
                    radius = default_branch.attendance_radius or DEFAULT_ATTENDANCE_RADIUS_METERS

        return branch_id, lat, lon, radius, branch_name or "", shift_start

    def _validate_location(
        self,
        actor: User,
        latitude: Optional[float],
        longitude: Optional[float],
        branch_lat: Optional[float],
        branch_lon: Optional[float],
        radius: int,
    ) -> float:
        if self._can_skip_location(actor):
            if latitude is not None and longitude is not None:
                if branch_lat is not None and branch_lon is not None:
                    _, distance = is_within_radius(
                        latitude, longitude, branch_lat, branch_lon, radius
                    )
                    return distance
            return 0.0

        validate_coordinates(latitude, longitude)
        if branch_lat is None or branch_lon is None:
            raise SalonERPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Salon attendance location is not configured. Contact your manager.",
            )

        within, distance = is_within_radius(
            latitude, longitude, branch_lat, branch_lon, radius
        )
        if not within:
            raise LocationOutsidePremisesException()
        return distance

    def _compute_late_minutes(
        self, check_in: datetime, shift_start: str
    ) -> Tuple[str, int]:
        check_in_aware = make_aware(check_in)
        try:
            hour, minute = map(int, shift_start.split(":"))
        except (ValueError, AttributeError):
            hour, minute = 9, 0

        shift_dt = check_in_aware.replace(
            hour=hour, minute=minute, second=0, microsecond=0, tzinfo=timezone.utc
        )
        if check_in_aware <= shift_dt:
            return ATTENDANCE_STATUS_PRESENT, 0

        late_seconds = (check_in_aware - shift_dt).total_seconds()
        late_minutes = int(late_seconds // 60)
        if late_minutes <= LATE_GRACE_MINUTES:
            return ATTENDANCE_STATUS_PRESENT, 0
        return ATTENDANCE_STATUS_LATE, late_minutes

    async def _write_log(
        self,
        attendance_id: str,
        action_type: str,
        action_by: str,
        old_value: Optional[str],
        new_value: Optional[str],
        tenant_id: str,
    ) -> None:
        log = AttendanceLog(
            tenant_id=tenant_id,
            attendance_id=attendance_id,
            action_type=action_type,
            action_by=action_by,
            old_value=old_value,
            new_value=new_value,
        )
        await log.insert()

    @staticmethod
    def _default_date_range(
        date_from: Optional[str], date_to: Optional[str]
    ) -> Tuple[str, str]:
        today = now_utc().strftime("%Y-%m-%d")
        if date_from and date_to:
            return date_from, date_to
        if date_from:
            return date_from, date_from
        if date_to:
            return date_to, date_to
        return today, today

    @staticmethod
    def _enrichment_date_range(
        date_from: Optional[str], date_to: Optional[str]
    ) -> Tuple[str, str]:
        if date_from or date_to:
            start, end = AttendanceService._default_date_range(date_from, date_to)
            return start, end
        now = now_utc()
        last_day = monthrange(now.year, now.month)[1]
        return (
            f"{now.year:04d}-{now.month:02d}-01",
            f"{now.year:04d}-{now.month:02d}-{last_day:02d}",
        )

    def _virtual_week_off_item(
        self,
        staff_id: str,
        employee_name: str,
        branch_name: str,
        date_str: str,
    ) -> AttendanceItem:
        now = now_utc()
        return AttendanceItem(
            id=f"week_off_{staff_id}_{date_str}",
            employee_id=staff_id,
            employee_name=employee_name,
            branch_name=branch_name or None,
            attendance_date=date_str,
            status=ATTENDANCE_STATUS_WEEK_OFF,
            attendance_method=ATTENDANCE_METHOD_MANUAL,
            created_at=now,
            updated_at=now,
        )

    def _enrich_records_with_week_off(
        self,
        records: List[Attendance],
        users_by_id: Dict[str, User],
        date_from: Optional[str],
        date_to: Optional[str],
    ) -> List[AttendanceItem]:
        range_start, range_end = self._enrichment_date_range(date_from, date_to)
        existing_by_staff_date = {
            (record.staff_id, record.date): record for record in records
        }
        enriched: List[AttendanceItem] = [
            self._to_item(
                record,
                self._full_name(users_by_id[record.staff_id])
                if record.staff_id in users_by_id
                else "Unknown",
                (users_by_id[record.staff_id].branch_name if record.staff_id in users_by_id else None)
                or "",
            )
            for record in records
        ]

        for staff_id, user in users_by_id.items():
            weekly_off = user.weekly_off or []
            if not weekly_off:
                continue
            employee_name = self._full_name(user)
            branch_name = user.branch_name or ""
            for date_str in week_off_dates_in_range(weekly_off, range_start, range_end):
                if (staff_id, date_str) in existing_by_staff_date:
                    continue
                enriched.append(
                    self._virtual_week_off_item(
                        staff_id, employee_name, branch_name, date_str
                    )
                )

        enriched.sort(
            key=lambda item: (item.attendance_date, item.employee_name),
            reverse=True,
        )
        return enriched

    async def _users_for_staff_ids(
        self, salon_id: str, staff_ids: List[str]
    ) -> Dict[str, User]:
        if not staff_ids:
            return {}
        object_ids = []
        for staff_id in staff_ids:
            try:
                object_ids.append(PydanticObjectId(staff_id))
            except Exception:
                continue
        if not object_ids:
            return {}
        users = await User.find(
            {"tenant_id": salon_id, "_id": {"$in": object_ids}, "is_deleted": False}
        ).to_list()
        return {str(user.id): user for user in users}

    def _to_item(self, record: Attendance, employee_name: str, branch_name: str = "") -> AttendanceItem:
        return AttendanceItem(
            id=str(record.id),
            employee_id=record.staff_id,
            employee_name=employee_name,
            branch_id=record.branch_id,
            branch_name=branch_name or None,
            attendance_date=record.date,
            check_in_time=record.clock_in,
            check_out_time=record.clock_out,
            status=record.status,
            late_minutes=record.late_minutes,
            total_work_minutes=record.total_work_minutes,
            total_hours=record.working_hours,
            latitude=record.latitude,
            longitude=record.longitude,
            distance_from_branch=record.distance_from_branch,
            attendance_method=record.attendance_method,
            notes=record.notes,
            created_at=record.created_at,
            updated_at=record.updated_at,
        )

    async def _employee_name_map(
        self, salon_id: str, staff_ids: List[str]
    ) -> Dict[str, str]:
        if not staff_ids:
            return {}
        object_ids = []
        for staff_id in staff_ids:
            try:
                object_ids.append(PydanticObjectId(staff_id))
            except Exception:
                continue
        if not object_ids:
            return {}
        users = await User.find(
            {"tenant_id": salon_id, "_id": {"$in": object_ids}, "is_deleted": False}
        ).to_list()
        return {str(user.id): self._full_name(user) for user in users}

    # ------------------------------------------------------------------ #
    # Check-in / Check-out
    # ------------------------------------------------------------------ #
    async def check_in(
        self, actor: User, latitude: Optional[float], longitude: Optional[float]
    ) -> AttendanceItem:
        salon_id = self._resolve_salon_id(actor)
        today = self._today_date()
        staff_id = str(actor.id)

        if is_week_off_day(actor.weekly_off or [], today):
            raise SalonERPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Today is your week off",
            )

        existing = await self.repo.get_by_employee_and_date(salon_id, staff_id, today)
        if existing and existing.clock_in:
            raise BookingConflictException(detail="Attendance already marked today")

        branch_id, branch_lat, branch_lon, radius, branch_name, shift_start = (
            await self._resolve_branch(actor, salon_id)
        )
        distance = self._validate_location(
            actor, latitude, longitude, branch_lat, branch_lon, radius
        )

        now = now_utc()
        status_value, late_minutes = self._compute_late_minutes(now, shift_start)

        if existing:
            existing.clock_in = now
            existing.status = status_value
            existing.late_minutes = late_minutes
            existing.latitude = latitude
            existing.longitude = longitude
            existing.distance_from_branch = distance
            existing.attendance_method = ATTENDANCE_METHOD_LOCATION
            existing.branch_id = branch_id
            await existing.save()
            record = existing
        else:
            record = Attendance(
                tenant_id=salon_id,
                staff_id=staff_id,
                branch_id=branch_id,
                salon_id=salon_id,
                date=today,
                status=status_value,
                clock_in=now,
                late_minutes=late_minutes,
                latitude=latitude,
                longitude=longitude,
                distance_from_branch=distance,
                attendance_method=ATTENDANCE_METHOD_LOCATION,
                created_by=str(actor.id),
                updated_by=str(actor.id),
            )
            await record.insert()

        await self._write_log(
            str(record.id),
            ATTENDANCE_LOG_CHECK_IN,
            str(actor.id),
            None,
            now.isoformat(),
            salon_id,
        )
        return self._to_item(record, self._full_name(actor), branch_name)

    async def check_out(
        self, actor: User, latitude: Optional[float], longitude: Optional[float]
    ) -> AttendanceItem:
        try:
            salon_id = self._resolve_salon_id(actor)
            today = self._today_date()
            staff_id = str(actor.id)

            record = await self.repo.get_by_employee_and_date(salon_id, staff_id, today)
            if not record or not record.clock_in:
                raise SalonERPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Check-in required before checkout",
                )
            if record.clock_out:
                raise BookingConflictException(detail="Checkout already completed")

            _, branch_lat, branch_lon, radius, branch_name, _ = (
                await self._resolve_branch(actor, salon_id)
            )
            distance = self._validate_location(
                actor, latitude, longitude, branch_lat, branch_lon, radius
            )

            now = now_utc()
            record.record_clock_out(now)
            if record.total_work_minutes < HALF_DAY_THRESHOLD_MINUTES and record.status not in {
                ATTENDANCE_STATUS_WEEK_OFF,
                ATTENDANCE_STATUS_ABSENT,
            }:
                if record.total_work_minutes > 0:
                    record.status = ATTENDANCE_STATUS_HALF_DAY

            if latitude is not None:
                record.latitude = latitude
            if longitude is not None:
                record.longitude = longitude
            record.distance_from_branch = distance
            await record.save()

            await self._write_log(
                str(record.id),
                ATTENDANCE_LOG_CHECK_OUT,
                str(actor.id),
                None,
                now.isoformat(),
                salon_id,
            )
            return self._to_item(record, self._full_name(actor), branch_name)
        except SalonERPException:
            raise
        except BookingConflictException:
            raise
        except Exception as exc:
            self.logger.exception("Checkout failed for user %s: %s", actor.id, exc)
            raise SalonERPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Unable to complete checkout. Please try again.",
            ) from exc

    # ------------------------------------------------------------------ #
    # Today status
    # ------------------------------------------------------------------ #
    async def get_today_status(self, actor: User) -> TodayAttendanceStatus:
        salon_id = self._resolve_salon_id(actor)
        today = self._today_date()
        staff_id = str(actor.id)

        _, branch_lat, branch_lon, _, _, shift_start = await self._resolve_branch(
            actor, salon_id
        )
        record = await self.repo.get_by_employee_and_date(salon_id, staff_id, today)
        is_week_off_today = is_week_off_day(actor.weekly_off or [], today)

        is_checked_in = bool(record and record.clock_in)
        is_checked_out = bool(record and record.clock_out)

        if is_week_off_today and not record:
            return TodayAttendanceStatus(
                attendance_date=today,
                shift_timing=actor.shift or shift_start,
                status=ATTENDANCE_STATUS_WEEK_OFF,
                can_check_in=False,
                can_check_out=False,
                is_checked_in=False,
                is_checked_out=False,
                location_required=False,
                branch_configured=branch_lat is not None and branch_lon is not None,
            )

        return TodayAttendanceStatus(
            attendance_date=today,
            shift_timing=actor.shift or shift_start,
            status=record.status if record else None,
            check_in_time=record.clock_in if record else None,
            check_out_time=record.clock_out if record else None,
            total_work_minutes=record.total_work_minutes if record else 0,
            total_hours=record.working_hours if record else 0.0,
            can_check_in=not is_checked_in and not is_week_off_today,
            can_check_out=is_checked_in and not is_checked_out and not is_week_off_today,
            is_checked_in=is_checked_in,
            is_checked_out=is_checked_out,
            location_required=self._location_required(actor) and not is_week_off_today,
            branch_configured=branch_lat is not None and branch_lon is not None,
        )

    # ------------------------------------------------------------------ #
    # Listing
    # ------------------------------------------------------------------ #
    async def _build_summary(self, records: List[Attendance]) -> AttendanceSummary:
        summary = AttendanceSummary()
        for record in records:
            summary.total_records += 1
            summary.total_work_hours += record.working_hours or 0.0
            if record.status == ATTENDANCE_STATUS_PRESENT:
                summary.present_count += 1
            elif record.status == ATTENDANCE_STATUS_LATE:
                summary.late_count += 1
            elif record.status == ATTENDANCE_STATUS_ABSENT:
                summary.absent_count += 1
            elif record.status == ATTENDANCE_STATUS_WEEK_OFF:
                summary.week_off_count += 1
            elif record.status == ATTENDANCE_STATUS_HALF_DAY:
                summary.half_day_count += 1
        summary.total_work_hours = round(summary.total_work_hours, 2)
        return summary

    async def get_attendance_summary(
        self,
        actor: User,
        employee_id: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        branch_id: Optional[str] = None,
        salon_id: Optional[str] = None,
    ) -> AttendanceSummary:
        role = normalize_role(actor.role)
        filters: Dict[str, Any] = {"is_deleted": False}

        if role == ROLE_EMPLOYEE:
            filters["tenant_id"] = self._resolve_salon_id(actor)
            filters["staff_id"] = str(actor.id)
        elif role in {ROLE_SALON_OWNER, ROLE_SALON_ADMIN, ROLE_SALON_MANAGER}:
            resolved_salon = self._resolve_salon_id(actor)
            filters["tenant_id"] = resolved_salon
            if employee_id:
                filters["staff_id"] = employee_id
            if role == ROLE_SALON_MANAGER:
                if branch_id:
                    filters["branch_id"] = branch_id
                elif actor.branch_id:
                    filters["branch_id"] = actor.branch_id
        elif role == ROLE_SUPER_ADMIN:
            if salon_id:
                filters["tenant_id"] = salon_id
            if employee_id:
                filters["staff_id"] = employee_id
        else:
            raise PermissionDeniedException()

        if date_from or date_to:
            date_filter: Dict[str, Any] = {}
            if date_from:
                date_filter["$gte"] = date_from
            if date_to:
                date_filter["$lte"] = date_to
            filters["date"] = date_filter

        records = await Attendance.find(filters).to_list()

        range_start, range_end = self._enrichment_date_range(date_from, date_to)
        staff_ids = list({record.staff_id for record in records})
        if employee_id:
            staff_ids.append(employee_id)
        elif role in {ROLE_SALON_OWNER, ROLE_SALON_ADMIN, ROLE_SALON_MANAGER}:
            staff_query: Dict[str, Any] = {
                "tenant_id": filters.get("tenant_id"),
                "role": {"$in": [ROLE_SALON_MANAGER, ROLE_EMPLOYEE]},
                "is_deleted": False,
            }
            if role == ROLE_SALON_MANAGER:
                if branch_id:
                    staff_query["branch_id"] = branch_id
                elif actor.branch_id:
                    staff_query["branch_id"] = actor.branch_id
            branch_staff = await User.find(staff_query).to_list()
            staff_ids.extend(str(user.id) for user in branch_staff)
        elif role == ROLE_EMPLOYEE:
            staff_ids.append(str(actor.id))

        staff_ids = list(dict.fromkeys(staff_ids))
        salon_for_users = filters.get("tenant_id") or self._resolve_salon_id(actor)
        users_by_id = await self._users_for_staff_ids(salon_for_users, staff_ids)

        summary = await self._build_summary(records)
        covered_dates = {(record.staff_id, record.date) for record in records}
        for staff_id, user in users_by_id.items():
            for date_str in week_off_dates_in_range(
                user.weekly_off or [], range_start, range_end
            ):
                if (staff_id, date_str) not in covered_dates:
                    summary.week_off_count += 1
                    summary.total_records += 1
        return summary

    async def list_my_attendance(
        self,
        actor: User,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        employee_id: Optional[str] = None,
    ) -> PaginatedAttendance:
        salon_id = self._resolve_salon_id(actor)
        target_staff = employee_id or str(actor.id)
        if employee_id and normalize_role(actor.role) == ROLE_EMPLOYEE and employee_id != str(actor.id):
            raise PermissionDeniedException()

        filters: Dict[str, Any] = {
            "tenant_id": salon_id,
            "staff_id": target_staff,
        }
        if date_from or date_to:
            date_filter: Dict[str, Any] = {}
            if date_from:
                date_filter["$gte"] = date_from
            if date_to:
                date_filter["$lte"] = date_to
            filters["date"] = date_filter

        items, total = await self.repo.list_paginated(filters, page, limit)
        employee = await User.get(target_staff)
        users_by_id: Dict[str, User] = {}
        if employee:
            users_by_id[target_staff] = employee
        result_items = self._enrich_records_with_week_off(
            items, users_by_id, date_from, date_to
        )

        if search:
            needle = search.lower()
            result_items = [
                item
                for item in result_items
                if needle in item.attendance_date
                or needle in (item.status or "").lower()
            ]

        pages = max(1, math.ceil(len(result_items) / limit)) if result_items else 1
        return PaginatedAttendance(
            items=result_items,
            total=len(result_items),
            page=page,
            limit=limit,
            pages=pages,
        )

    async def list_branch_attendance(
        self,
        actor: User,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        branch_id: Optional[str] = None,
        employee_id: Optional[str] = None,
    ) -> PaginatedAttendance:
        role = normalize_role(actor.role)
        if role == ROLE_EMPLOYEE:
            raise PermissionDeniedException()

        salon_id = self._resolve_salon_id(actor)
        filters: Dict[str, Any] = {"tenant_id": salon_id}

        if employee_id:
            filters["staff_id"] = employee_id

        if role == ROLE_SALON_MANAGER:
            branch_filter = branch_id or actor.branch_id
            if branch_filter:
                filters["branch_id"] = branch_filter
            elif actor.branch_name:
                staff_query: Dict[str, Any] = {
                    "tenant_id": salon_id,
                    "branch_name": actor.branch_name,
                    "is_deleted": False,
                }
                branch_staff = await User.find(staff_query).to_list()
                filters["staff_id"] = {"$in": [str(u.id) for u in branch_staff]}
        elif branch_id:
            filters["branch_id"] = branch_id

        if date_from or date_to:
            date_filter: Dict[str, Any] = {}
            if date_from:
                date_filter["$gte"] = date_from
            if date_to:
                date_filter["$lte"] = date_to
            filters["date"] = date_filter

        items, total = await self.repo.list_paginated(filters, page, limit)
        staff_ids = list({item.staff_id for item in items})
        if employee_id:
            staff_ids.append(employee_id)
        staff_ids = list(dict.fromkeys(staff_ids))
        users_by_id = await self._users_for_staff_ids(salon_id, staff_ids)
        result_items = self._enrich_records_with_week_off(
            items, users_by_id, date_from, date_to
        )

        if search:
            needle = search.lower()
            result_items = [
                item
                for item in result_items
                if needle in item.attendance_date
                or needle in item.employee_name.lower()
                or needle in (item.status or "").lower()
            ]

        pages = max(1, math.ceil(total / limit)) if total else 1
        return PaginatedAttendance(
            items=result_items,
            total=len(result_items),
            page=page,
            limit=limit,
            pages=pages,
        )

    async def list_all_attendance(
        self,
        actor: User,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        salon_id: Optional[str] = None,
        employee_id: Optional[str] = None,
    ) -> PaginatedAttendance:
        if normalize_role(actor.role) != ROLE_SUPER_ADMIN:
            raise PermissionDeniedException()

        filters: Dict[str, Any] = {"is_deleted": False}
        if salon_id:
            filters["tenant_id"] = salon_id
        if employee_id:
            filters["staff_id"] = employee_id
        if date_from or date_to:
            date_filter: Dict[str, Any] = {}
            if date_from:
                date_filter["$gte"] = date_from
            if date_to:
                date_filter["$lte"] = date_to
            filters["date"] = date_filter

        items, total = await self.repo.list_paginated(filters, page, limit)
        staff_ids = list({item.staff_id for item in items})
        if employee_id:
            staff_ids.append(employee_id)
        staff_ids = list(dict.fromkeys(staff_ids))
        users_by_id: Dict[str, User] = {}
        tenant_ids = list({item.tenant_id for item in items if item.tenant_id})
        if salon_id:
            tenant_ids.append(salon_id)
        tenant_ids = list(dict.fromkeys(tenant_ids))
        for tid in tenant_ids:
            users_by_id.update(await self._users_for_staff_ids(tid, staff_ids))

        result_items = self._enrich_records_with_week_off(
            items, users_by_id, date_from, date_to
        )

        if search:
            needle = search.lower()
            result_items = [
                item
                for item in result_items
                if needle in item.attendance_date
                or needle in item.employee_name.lower()
                or needle in (item.status or "").lower()
            ]

        pages = max(1, math.ceil(total / limit)) if total else 1
        return PaginatedAttendance(
            items=result_items,
            total=len(result_items),
            page=page,
            limit=limit,
            pages=pages,
        )

    # ------------------------------------------------------------------ #
    # Manual update
    # ------------------------------------------------------------------ #
    async def manual_update(
        self, actor: User, payload: ManualAttendanceUpdate
    ) -> AttendanceItem:
        role = normalize_role(actor.role)
        if role in {ROLE_EMPLOYEE}:
            raise PermissionDeniedException()

        salon_id = self._resolve_salon_id(actor)
        record = await Attendance.get(payload.attendance_id)
        if not record or record.is_deleted:
            raise ResourceNotFoundException(detail="Attendance record not found")

        if role != ROLE_SUPER_ADMIN and record.tenant_id != salon_id:
            raise PermissionDeniedException()

        if role == ROLE_SALON_MANAGER:
            if record.branch_id and actor.branch_id and record.branch_id != actor.branch_id:
                raise PermissionDeniedException()

        old_snapshot = f"status={record.status},in={record.clock_in},out={record.clock_out}"

        if payload.status:
            record.status = payload.status
        if payload.check_in_time:
            record.clock_in = payload.check_in_time
        if payload.check_out_time:
            if not record.clock_in:
                raise SalonERPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot set check-out before check-in",
                )
            if payload.check_out_time < record.clock_in:
                raise SalonERPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Check-out cannot be before check-in",
                )
            record.record_clock_out(payload.check_out_time)
        if payload.notes is not None:
            record.notes = payload.notes

        record.attendance_method = ATTENDANCE_METHOD_MANUAL
        record.updated_by = str(actor.id)
        await record.save()

        employee = await User.get(record.staff_id)
        employee_name = self._full_name(employee) if employee else "Unknown"

        await self._write_log(
            str(record.id),
            ATTENDANCE_LOG_MANUAL_UPDATE,
            str(actor.id),
            old_snapshot,
            f"status={record.status},in={record.clock_in},out={record.clock_out}",
            record.tenant_id or salon_id,
        )
        return self._to_item(record, employee_name)

    # ------------------------------------------------------------------ #
    # Branch location
    # ------------------------------------------------------------------ #
    async def get_branch_location(self, actor: User) -> BranchLocationResponse:
        salon_id = self._resolve_salon_id(actor)
        branch_id, lat, lon, radius, branch_name, shift_start = await self._resolve_branch(
            actor, salon_id
        )
        return BranchLocationResponse(
            branch_id=branch_id,
            branch_name=branch_name or None,
            latitude=lat,
            longitude=lon,
            attendance_radius=radius,
            shift_start=shift_start,
            is_configured=lat is not None and lon is not None,
        )

    async def update_branch_location(
        self, actor: User, payload: BranchLocationUpdate
    ) -> BranchLocationResponse:
        role = normalize_role(actor.role)
        if role not in {ROLE_SUPER_ADMIN, ROLE_SALON_OWNER, ROLE_SALON_ADMIN}:
            raise PermissionDeniedException()

        salon_id = self._resolve_salon_id(actor)
        tenant = await Tenant.get(salon_id)
        if not tenant:
            raise ResourceNotFoundException(detail="Salon not found")

        if payload.branch_id:
            branch = await Salon.get(payload.branch_id)
            if not branch or branch.tenant_id != salon_id:
                raise ResourceNotFoundException(detail="Branch not found")
            branch.latitude = payload.latitude
            branch.longitude = payload.longitude
            branch.attendance_radius = payload.attendance_radius
            await branch.save()
            branch_id = str(branch.id)
            branch_name = branch.name
        else:
            tenant.latitude = payload.latitude
            tenant.longitude = payload.longitude
            tenant.attendance_radius = payload.attendance_radius
            if payload.shift_start:
                tenant.shift_start = payload.shift_start
            await tenant.save()
            default_branch = await Salon.find_one(
                {"tenant_id": salon_id, "is_deleted": False, "is_active": True}
            )
            if default_branch:
                default_branch.latitude = payload.latitude
                default_branch.longitude = payload.longitude
                default_branch.attendance_radius = payload.attendance_radius
                await default_branch.save()
                branch_id = str(default_branch.id)
                branch_name = default_branch.name
            else:
                branch_id = None
                branch_name = tenant.name

        return BranchLocationResponse(
            branch_id=branch_id,
            branch_name=branch_name,
            latitude=payload.latitude,
            longitude=payload.longitude,
            attendance_radius=payload.attendance_radius,
            shift_start=payload.shift_start or tenant.shift_start,
            is_configured=True,
        )
