import logging
import math
from calendar import monthrange
from datetime import datetime, timedelta, timezone
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
    ATTENDANCE_STATUS_LEAVE,
    ATTENDANCE_STATUS_PRESENT,
    ATTENDANCE_STATUS_WEEK_OFF,
    DEFAULT_ATTENDANCE_RADIUS_METERS,
    DEFAULT_SHIFT_START,
    DEFAULT_SHIFT_END,
    EVENT_ATTENDANCE_CHECK_IN,
    HALF_DAY_THRESHOLD_MINUTES,
    NOTIFICATION_CATEGORY_ATTENDANCE,
    NOTIFICATION_TYPE_LATE_ATTENDANCE,
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
from app.services.leave import AttendanceReconciliationService, LeaveService
from app.services.notifications import notification_service
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
from app.utils.timezone import (
    KOLKATA_TZ,
    combine_ist_datetime,
    make_aware,
    now_ist,
    now_utc,
    to_ist,
    today_ist_str,
    yesterday_ist_str,
)
from app.utils.week_off import is_week_off_day, week_off_dates_in_range
from fastapi import status


def format_time_12h(time_str: Optional[str]) -> Optional[str]:
    """Converts HH:MM (e.g. 10:00, 19:00) into 10:00 AM, 7:00 PM."""
    if not time_str:
        return None
    try:
        parts = time_str.strip().split(":")
        h, m = int(parts[0]), int(parts[1])
        meridiem = "AM" if h < 12 else "PM"
        h12 = h % 12
        if h12 == 0:
            h12 = 12
        return f"{h12}:{m:02d} {meridiem}"
    except Exception:
        return time_str


def format_shift_range(start: Optional[str], end: Optional[str]) -> Optional[str]:
    """Formats shift range nicely: 10:00 AM – 7:00 PM or None."""
    if not start and not end:
        return None
    start_12 = format_time_12h(start) if start else ""
    end_12 = format_time_12h(end) if end else ""
    if start_12 and end_12:
        return f"{start_12} – {end_12}"
    return start_12 or end_12 or None


def _normalize_hhmm(val: str) -> Optional[str]:
    """Converts 10:00, 7:00 PM, 10:00 AM, 19:00 to HH:MM format."""
    val = val.strip().upper()
    is_pm = "PM" in val
    is_am = "AM" in val
    cleaned = val.replace("AM", "").replace("PM", "").strip()
    parts = cleaned.split(":")
    if len(parts) >= 2:
        try:
            h = int(parts[0])
            m = int(parts[1][:2])
            if is_pm and h < 12:
                h += 12
            elif is_am and h == 12:
                h = 0
            return f"{h:02d}:{m:02d}"
        except Exception:
            return None
    elif len(parts) == 1 and parts[0].isdigit():
        try:
            h = int(parts[0])
            if is_pm and h < 12:
                h += 12
            elif is_am and h == 12:
                h = 0
            return f"{h:02d}:00"
        except Exception:
            return None
    return None


def parse_shift_string(raw: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    """
    Parses various shift string formats:
    "10:00 - 19:00", "10:00-19:00", "10:00 AM - 7:00 PM", "20:00 - 05:00"
    Returns (start_hh_mm, end_hh_mm).
    """
    if not raw or not isinstance(raw, str):
        return None, None
    raw = raw.strip()
    for sep in [" - ", " – ", "-", " to "]:
        if sep in raw:
            parts = raw.split(sep, 1)
            start_str = _normalize_hhmm(parts[0].strip())
            end_str = _normalize_hhmm(parts[1].strip())
            if start_str:
                return start_str, end_str
    norm = _normalize_hhmm(raw)
    if norm:
        return norm, None
    return None, None


class LocationOutsidePremisesException(SalonERPException):
    def __init__(self, detail: str = "You are outside salon premises") -> None:
        super().__init__(status_code=status.HTTP_400_BAD_REQUEST, detail=detail)


class AttendanceService:
    """Business logic for attendance check-in/out, listing, and manual corrections."""

    def __init__(self) -> None:
        self.logger = logging.getLogger(__name__)
        self.repo = AttendanceRepository()
        self.reconciliation_service = AttendanceReconciliationService()
        self.leave_service = LeaveService()

    async def _ensure_reconciled(
        self, actor: User, salon_id: Optional[str] = None
    ) -> None:
        try:
            await self.reconciliation_service.reconcile_for_actor(actor, salon_id=salon_id)
        except Exception as exc:
            self.logger.warning("Previous-day attendance reconciliation skipped: %s", exc)

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
        from app.utils.user_name import user_display_name

        return user_display_name(user)

    @staticmethod
    def _today_date() -> str:
        return today_ist_str()

    @staticmethod
    def _yesterday_date() -> str:
        return yesterday_ist_str()

    def _resolve_shift(
        self, user: Optional[User], tenant: Optional[Tenant]
    ) -> Tuple[str, str, str]:
        """
        Resolves effective shift:
        staff shift -> salon default shift -> safe fallback
        Returns (shift_start, shift_end, shift_display)
        """
        shift_start = None
        shift_end = None

        if user:
            if getattr(user, "shift_start", None) and getattr(user, "shift_end", None):
                shift_start = user.shift_start
                shift_end = user.shift_end
            elif getattr(user, "shift", None):
                s, e = parse_shift_string(user.shift)
                if s:
                    shift_start = s
                if e:
                    shift_end = e

        if not shift_start and tenant:
            shift_start = tenant.shift_start
        if not shift_end and tenant:
            shift_end = getattr(tenant, "shift_end", None)

        if not shift_start:
            shift_start = DEFAULT_SHIFT_START
        if not shift_end:
            shift_end = DEFAULT_SHIFT_END

        shift_display = format_shift_range(shift_start, shift_end) or f"{shift_start} – {shift_end}"
        return shift_start, shift_end, shift_display

    def _location_required(self, actor: User) -> bool:
        role = normalize_role(actor.role)
        return role in {ROLE_EMPLOYEE, ROLE_SALON_MANAGER}

    def _can_skip_location(self, actor: User) -> bool:
        role = normalize_role(actor.role)
        return role in {ROLE_SUPER_ADMIN, ROLE_SALON_OWNER}

    async def _resolve_branch(
        self, actor: User, salon_id: str
    ) -> Tuple[Optional[str], Optional[float], Optional[float], int, str, str, str, Optional[str]]:
        """
        Resolve branch coordinates and shift start/end.
        Returns: branch_id, lat, lon, radius, branch_name, shift_start, shift_end, address
        """
        branch_id = actor.branch_id
        branch_name = actor.branch_name
        lat: Optional[float] = None
        lon: Optional[float] = None
        radius = DEFAULT_ATTENDANCE_RADIUS_METERS
        shift_start = DEFAULT_SHIFT_START
        shift_end = DEFAULT_SHIFT_END
        address: Optional[str] = None

        tenant = await Tenant.get(salon_id)
        if tenant:
            shift_start = tenant.shift_start or DEFAULT_SHIFT_START
            shift_end = getattr(tenant, "shift_end", None) or DEFAULT_SHIFT_END
            if tenant.latitude is not None and tenant.longitude is not None:
                lat = tenant.latitude
                lon = tenant.longitude
                radius = tenant.attendance_radius or DEFAULT_ATTENDANCE_RADIUS_METERS

        if branch_id:
            salon_branch = await Salon.get(branch_id)
            if salon_branch and salon_branch.tenant_id == salon_id:
                branch_name = salon_branch.name
                address = self._format_salon_address(salon_branch.address)
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
                address = self._format_salon_address(default_branch.address)
                if (
                    default_branch.latitude is not None
                    and default_branch.longitude is not None
                ):
                    lat = default_branch.latitude
                    lon = default_branch.longitude
                    radius = default_branch.attendance_radius or DEFAULT_ATTENDANCE_RADIUS_METERS

        return branch_id, lat, lon, radius, branch_name or "", shift_start, shift_end, address

    @staticmethod
    def _format_salon_address(address: Optional[dict]) -> Optional[str]:
        if not address or not isinstance(address, dict):
            return None
        text = address.get("text")
        if isinstance(text, str) and text.strip():
            return text.strip()
        parts = [
            address.get("line1") or address.get("street"),
            address.get("line2"),
            address.get("city"),
            address.get("state"),
            address.get("pincode") or address.get("postal_code"),
        ]
        formatted = ", ".join(str(part).strip() for part in parts if part)
        return formatted or None

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
        self, check_in: datetime, shift_date: str, shift_start: str
    ) -> Tuple[str, int]:
        """
        Calculates late minutes by comparing check-in against assigned shift start
        in the Asia/Kolkata timezone.
        """
        check_in_ist = to_ist(check_in)
        try:
            shift_start_dt = combine_ist_datetime(shift_date, shift_start)
        except Exception:
            shift_start_dt = combine_ist_datetime(shift_date, DEFAULT_SHIFT_START)

        if check_in_ist <= shift_start_dt:
            return ATTENDANCE_STATUS_PRESENT, 0

        late_seconds = (check_in_ist - shift_start_dt).total_seconds()
        late_minutes = int(late_seconds // 60)
        if late_minutes > 0:
            return ATTENDANCE_STATUS_LATE, late_minutes
        return ATTENDANCE_STATUS_PRESENT, 0

    async def _send_late_notification(
        self,
        record: Attendance,
        employee: User,
        tenant_id: str,
        shift_start: str,
        shift_end: str,
        branch_name: Optional[str] = None,
    ) -> None:
        """
        Sends an in-app late attendance alert to the Salon Owner and relevant Salon Manager(s).
        Deduplicated per attendance session. Never sent to other staff or unrelated users.
        """
        if record.late_notified or record.late_minutes <= 0:
            return

        try:
            record.late_notified = True
            await record.save()

            candidate_users = await User.find(
                {
                    "tenant_id": tenant_id,
                    "is_deleted": False,
                    "is_active": True,
                    "role": {"$in": [ROLE_SALON_OWNER, ROLE_SALON_ADMIN, ROLE_SALON_MANAGER]},
                }
            ).to_list()

            recipients: List[User] = []
            for u in candidate_users:
                if str(u.id) == str(employee.id):
                    continue
                role_norm = normalize_role(u.role)
                if role_norm in {ROLE_SALON_OWNER, ROLE_SALON_ADMIN}:
                    recipients.append(u)
                elif role_norm == ROLE_SALON_MANAGER:
                    if record.branch_id and u.branch_id and u.branch_id != record.branch_id:
                        continue
                    recipients.append(u)

            if not recipients:
                return

            employee_name = self._full_name(employee)
            shift_display = format_shift_range(shift_start, shift_end) or f"{shift_start} – {shift_end}"
            check_in_ist = to_ist(record.clock_in) if record.clock_in else now_ist()
            check_in_str = check_in_ist.strftime("%I:%M %p").lstrip("0")
            date_display = check_in_ist.strftime("%d %b %Y")

            body = (
                f"{employee_name} checked in {record.late_minutes} minutes late.\n\n"
                f"Shift: {shift_display}\n"
                f"Check In: {check_in_str}\n"
                f"Date: {date_display}"
            )

            await notification_service.create_event_notifications(
                tenant_id=tenant_id,
                salon_id=tenant_id,
                recipients=recipients,
                title="Late Attendance",
                body=body,
                category=NOTIFICATION_CATEGORY_ATTENDANCE,
                notification_type=NOTIFICATION_TYPE_LATE_ATTENDANCE,
                priority="NORMAL",
                source_event=EVENT_ATTENDANCE_CHECK_IN,
                metadata={
                    "attendance_id": str(record.id),
                    "employee_id": str(employee.id),
                    "late_minutes": record.late_minutes,
                },
            )
        except Exception as exc:
            self.logger.warning("Failed to send late attendance notification: %s", exc)

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
        today = today_ist_str()
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
        now = now_ist()
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
            shift_timing="Week Off",
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
        shift_display = format_shift_range(record.shift_start, record.shift_end)
        return AttendanceItem(
            id=str(record.id),
            employee_id=record.staff_id,
            employee_name=employee_name,
            branch_id=record.branch_id,
            branch_name=branch_name or None,
            attendance_date=record.date,
            check_in_time=record.clock_in,
            check_out_time=record.clock_out,
            shift_start=record.shift_start,
            shift_end=record.shift_end,
            shift_timing=shift_display,
            status=record.status,
            late_minutes=record.late_minutes,
            overtime_minutes=record.overtime_minutes,
            early_leave_minutes=record.early_leave_minutes,
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
        self,
        actor: User,
        latitude: Optional[float],
        longitude: Optional[float],
        target_employee_id: Optional[str] = None,
        date_str: Optional[str] = None,
    ) -> AttendanceItem:
        salon_id = self._resolve_salon_id(actor)
        actor_role = normalize_role(actor.role)

        target_user = actor
        if target_employee_id and target_employee_id != str(actor.id):
            if actor_role not in {ROLE_SUPER_ADMIN, ROLE_SALON_OWNER, ROLE_SALON_ADMIN, ROLE_SALON_MANAGER}:
                raise PermissionDeniedException(detail="Not authorized to mark attendance for other employees")
            found_user = await User.get(target_employee_id)
            if not found_user or found_user.is_deleted:
                raise ResourceNotFoundException(detail="Target employee not found")
            if actor_role != ROLE_SUPER_ADMIN and found_user.tenant_id != salon_id:
                raise PermissionDeniedException(detail="Target employee belongs to another salon")
            target_user = found_user

        staff_id = str(target_user.id)
        target_salon_id = target_user.tenant_id or salon_id
        await self._ensure_reconciled(actor, salon_id=target_salon_id)
        today = date_str or self._today_date()

        if is_week_off_day(target_user.weekly_off or [], today):
            raise SalonERPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Today is {self._full_name(target_user)}'s week off",
            )

        if await self.leave_service.has_approved_leave_on_date(target_salon_id, staff_id, today):
            raise SalonERPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Today is {self._full_name(target_user)}'s approved leave day",
            )

        existing = await self.repo.get_by_employee_and_date(target_salon_id, staff_id, today)
        if existing and existing.clock_in:
            raise BookingConflictException(detail="Attendance already marked for today")

        tenant = await Tenant.get(target_salon_id)
        shift_start, shift_end, shift_display = self._resolve_shift(target_user, tenant)

        branch_id, branch_lat, branch_lon, radius, branch_name, _, _, _ = (
            await self._resolve_branch(target_user, target_salon_id)
        )
        distance = self._validate_location(
            actor, latitude, longitude, branch_lat, branch_lon, radius
        )

        now = now_utc()
        status_value, late_minutes = self._compute_late_minutes(now, today, shift_start)

        if existing:
            existing.clock_in = now
            existing.status = status_value
            existing.late_minutes = late_minutes
            existing.shift_start = shift_start
            existing.shift_end = shift_end
            existing.latitude = latitude
            existing.longitude = longitude
            existing.distance_from_branch = distance
            existing.attendance_method = (
                ATTENDANCE_METHOD_LOCATION if not self._can_skip_location(actor) else ATTENDANCE_METHOD_MANUAL
            )
            existing.branch_id = branch_id
            await existing.save()
            record = existing
        else:
            record = Attendance(
                tenant_id=target_salon_id,
                staff_id=staff_id,
                branch_id=branch_id,
                salon_id=target_salon_id,
                date=today,
                status=status_value,
                shift_start=shift_start,
                shift_end=shift_end,
                clock_in=now,
                late_minutes=late_minutes,
                latitude=latitude,
                longitude=longitude,
                distance_from_branch=distance,
                attendance_method=(
                    ATTENDANCE_METHOD_LOCATION if not self._can_skip_location(actor) else ATTENDANCE_METHOD_MANUAL
                ),
                created_by=str(actor.id),
                updated_by=str(actor.id),
            )
            await record.insert()

        if late_minutes > 0:
            await self._send_late_notification(
                record=record,
                employee=target_user,
                tenant_id=target_salon_id,
                shift_start=shift_start,
                shift_end=shift_end,
                branch_name=branch_name,
            )

        await self._write_log(
            str(record.id),
            ATTENDANCE_LOG_CHECK_IN,
            str(actor.id),
            None,
            now.isoformat(),
            target_salon_id,
        )
        return self._to_item(record, self._full_name(target_user), branch_name)

    async def check_out(
        self,
        actor: User,
        latitude: Optional[float],
        longitude: Optional[float],
        target_employee_id: Optional[str] = None,
        date_str: Optional[str] = None,
    ) -> AttendanceItem:
        try:
            salon_id = self._resolve_salon_id(actor)
            actor_role = normalize_role(actor.role)

            target_user = actor
            if target_employee_id and target_employee_id != str(actor.id):
                if actor_role not in {ROLE_SUPER_ADMIN, ROLE_SALON_OWNER, ROLE_SALON_ADMIN, ROLE_SALON_MANAGER}:
                    raise PermissionDeniedException(detail="Not authorized to mark attendance for other employees")
                found_user = await User.get(target_employee_id)
                if not found_user or found_user.is_deleted:
                    raise ResourceNotFoundException(detail="Target employee not found")
                if actor_role != ROLE_SUPER_ADMIN and found_user.tenant_id != salon_id:
                    raise PermissionDeniedException(detail="Target employee belongs to another salon")
                target_user = found_user

            staff_id = str(target_user.id)
            target_salon_id = target_user.tenant_id or salon_id
            await self._ensure_reconciled(actor, salon_id=target_salon_id)
            today = date_str or self._today_date()

            record = await self.repo.get_by_employee_and_date(target_salon_id, staff_id, today)
            if not record or not record.clock_in or record.clock_out:
                # Check for recent open session (e.g. overnight shift started yesterday)
                open_session = await self.repo.get_open_session_for_employee(target_salon_id, staff_id)
                if open_session:
                    record = open_session

            if not record or not record.clock_in:
                raise SalonERPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Check-in required before checkout",
                )
            if record.clock_out:
                raise BookingConflictException(detail="Checkout already completed")

            tenant = await Tenant.get(target_salon_id)
            shift_start, shift_end, _ = self._resolve_shift(target_user, tenant)

            _, branch_lat, branch_lon, radius, branch_name, _, _, _ = (
                await self._resolve_branch(target_user, target_salon_id)
            )
            distance = self._validate_location(
                actor, latitude, longitude, branch_lat, branch_lon, radius
            )

            now = now_utc()
            record.record_clock_out(
                now,
                shift_end=record.shift_end or shift_end,
                shift_start=record.shift_start or shift_start,
            )
            if record.total_work_minutes < HALF_DAY_THRESHOLD_MINUTES and record.status not in {
                ATTENDANCE_STATUS_WEEK_OFF,
                ATTENDANCE_STATUS_ABSENT,
                ATTENDANCE_STATUS_LEAVE,
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
                target_salon_id,
            )
            return self._to_item(record, self._full_name(target_user), branch_name)
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
    async def get_today_status(
        self, actor: User, target_employee_id: Optional[str] = None
    ) -> TodayAttendanceStatus:
        salon_id = self._resolve_salon_id(actor)
        actor_role = normalize_role(actor.role)

        target_user = actor
        if target_employee_id and target_employee_id != str(actor.id):
            if actor_role not in {ROLE_SUPER_ADMIN, ROLE_SALON_OWNER, ROLE_SALON_ADMIN, ROLE_SALON_MANAGER}:
                raise PermissionDeniedException()
            found_user = await User.get(target_employee_id)
            if found_user and not found_user.is_deleted:
                target_user = found_user

        staff_id = str(target_user.id)
        target_salon_id = target_user.tenant_id or salon_id
        await self._ensure_reconciled(actor, salon_id=target_salon_id)
        today = self._today_date()

        tenant = await Tenant.get(target_salon_id)
        shift_start, shift_end, shift_display = self._resolve_shift(target_user, tenant)

        _, branch_lat, branch_lon, _, _, _, _, _ = await self._resolve_branch(
            target_user, target_salon_id
        )
        record = await self.repo.get_by_employee_and_date(target_salon_id, staff_id, today)
        if not record or not record.clock_in or record.clock_out:
            open_session = await self.repo.get_open_session_for_employee(target_salon_id, staff_id)
            if open_session:
                record = open_session

        is_week_off_today = is_week_off_day(target_user.weekly_off or [], today)
        on_approved_leave = await self.leave_service.has_approved_leave_on_date(
            target_salon_id, staff_id, today
        )

        is_checked_in = bool(record and record.clock_in)
        is_checked_out = bool(record and record.clock_out)

        eff_shift_start = (record.shift_start if record and record.shift_start else shift_start)
        eff_shift_end = (record.shift_end if record and record.shift_end else shift_end)
        eff_shift_timing = format_shift_range(eff_shift_start, eff_shift_end) or shift_display

        if on_approved_leave and not record:
            return TodayAttendanceStatus(
                attendance_date=today,
                shift_start=eff_shift_start,
                shift_end=eff_shift_end,
                shift_timing=eff_shift_timing,
                status=ATTENDANCE_STATUS_LEAVE,
                can_check_in=False,
                can_check_out=False,
                is_checked_in=False,
                is_checked_out=False,
                location_required=False,
                branch_configured=branch_lat is not None and branch_lon is not None,
            )

        if is_week_off_today and not record:
            return TodayAttendanceStatus(
                attendance_date=today,
                shift_start=eff_shift_start,
                shift_end=eff_shift_end,
                shift_timing=eff_shift_timing,
                status=ATTENDANCE_STATUS_WEEK_OFF,
                can_check_in=False,
                can_check_out=False,
                is_checked_in=False,
                is_checked_out=False,
                location_required=False,
                branch_configured=branch_lat is not None and branch_lon is not None,
            )

        loc_required = False if self._can_skip_location(actor) else self._location_required(target_user)

        return TodayAttendanceStatus(
            attendance_date=record.date if record else today,
            shift_start=eff_shift_start,
            shift_end=eff_shift_end,
            shift_timing=eff_shift_timing,
            status=record.status if record else None,
            check_in_time=record.clock_in if record else None,
            check_out_time=record.clock_out if record else None,
            late_minutes=record.late_minutes if record else 0,
            overtime_minutes=record.overtime_minutes if record else 0,
            early_leave_minutes=record.early_leave_minutes if record else 0,
            total_work_minutes=record.total_work_minutes if record else 0,
            total_hours=record.working_hours if record else 0.0,
            can_check_in=not is_checked_in and not is_week_off_today and not on_approved_leave,
            can_check_out=is_checked_in and not is_checked_out,
            is_checked_in=is_checked_in,
            is_checked_out=is_checked_out,
            location_required=loc_required and not is_week_off_today and not on_approved_leave,
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
            elif record.status == ATTENDANCE_STATUS_LEAVE:
                summary.leave_count += 1
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
        await self._ensure_reconciled(actor, salon_id=salon_id)
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
        await self._ensure_reconciled(actor, salon_id=salon_id)
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
        await self._ensure_reconciled(actor, salon_id=salon_id)
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

        await self._ensure_reconciled(actor, salon_id=salon_id)
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
        record: Optional[Attendance] = None

        if payload.attendance_id:
            record = await Attendance.get(payload.attendance_id)
            if not record or record.is_deleted:
                raise ResourceNotFoundException(detail="Attendance record not found")
        elif payload.employee_id:
            target_user = await User.get(payload.employee_id)
            if not target_user or target_user.is_deleted:
                raise ResourceNotFoundException(detail="Target employee not found")

            target_salon = target_user.tenant_id or salon_id
            if role != ROLE_SUPER_ADMIN and target_salon != salon_id:
                raise PermissionDeniedException()

            date_val = payload.attendance_date or self._today_date()
            record = await self.repo.get_by_employee_and_date(target_salon, str(target_user.id), date_val)
            if not record:
                branch_id, _, _, _, _, _, _, _ = await self._resolve_branch(target_user, target_salon)
                tenant = await Tenant.get(target_salon)
                shift_start, shift_end, _ = self._resolve_shift(target_user, tenant)
                record = Attendance(
                    tenant_id=target_salon,
                    staff_id=str(target_user.id),
                    branch_id=branch_id,
                    salon_id=target_salon,
                    date=date_val,
                    status=payload.status or ATTENDANCE_STATUS_PRESENT,
                    clock_in=payload.check_in_time,
                    clock_out=payload.check_out_time,
                    shift_start=shift_start,
                    shift_end=shift_end,
                    attendance_method=ATTENDANCE_METHOD_MANUAL,
                    notes=payload.notes,
                    created_by=str(actor.id),
                    updated_by=str(actor.id),
                )
                if payload.check_out_time:
                    record.record_clock_out(
                        payload.check_out_time,
                        shift_end=shift_end,
                        shift_start=shift_start,
                    )
                await record.insert()
                await self._write_log(
                    str(record.id),
                    ATTENDANCE_LOG_MANUAL_UPDATE,
                    str(actor.id),
                    "new_record",
                    f"status={record.status},in={record.clock_in},out={record.clock_out}",
                    target_salon,
                )
                return self._to_item(record, self._full_name(target_user))

        if not record:
            raise SalonERPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Either attendance_id or employee_id is required",
            )

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
            target_employee = await User.get(record.staff_id)
            tenant = await Tenant.get(record.tenant_id or salon_id)
            shift_start, shift_end, _ = self._resolve_shift(target_employee, tenant)
            record.record_clock_out(
                payload.check_out_time,
                shift_end=record.shift_end or shift_end,
                shift_start=record.shift_start or shift_start,
            )
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
        branch_id, lat, lon, radius, branch_name, shift_start, shift_end, address = (
            await self._resolve_branch(actor, salon_id)
        )
        return BranchLocationResponse(
            branch_id=branch_id,
            branch_name=branch_name or None,
            address=address,
            latitude=lat,
            longitude=lon,
            attendance_radius=radius,
            shift_start=shift_start,
            shift_end=shift_end,
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
            address = self._format_salon_address(branch.address)
        else:
            tenant.latitude = payload.latitude
            tenant.longitude = payload.longitude
            tenant.attendance_radius = payload.attendance_radius
            if payload.shift_start:
                tenant.shift_start = payload.shift_start
            if payload.shift_end:
                tenant.shift_end = payload.shift_end
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
                address = self._format_salon_address(default_branch.address)
            else:
                branch_id = None
                branch_name = tenant.name
                address = None

        return BranchLocationResponse(
            branch_id=branch_id,
            branch_name=branch_name,
            address=address,
            latitude=payload.latitude,
            longitude=payload.longitude,
            attendance_radius=payload.attendance_radius,
            shift_start=payload.shift_start or tenant.shift_start,
            shift_end=payload.shift_end or getattr(tenant, "shift_end", DEFAULT_SHIFT_END),
            is_configured=True,
        )
