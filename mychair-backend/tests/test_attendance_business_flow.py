import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId

from app.constants.attendance_options import (
    ATTENDANCE_STATUS_PRESENT,
    ATTENDANCE_STATUS_LATE,
    ATTENDANCE_STATUS_ABSENT,
    ATTENDANCE_STATUS_LEAVE,
    ATTENDANCE_STATUS_WEEK_OFF,
    NOTIFICATION_TYPE_LATE_ATTENDANCE,
    NOTIFICATION_CATEGORY_ATTENDANCE,
)
from app.utils.timezone import (
    KOLKATA_TZ,
    now_ist,
    now_utc,
    to_ist,
    today_ist_str,
    yesterday_ist_str,
    combine_ist_datetime,
)
from app.models.attendance import Attendance
from app.models.tenant import Tenant
from app.models.user import User
from app.services.attendance import (
    AttendanceService,
    parse_shift_string,
    format_shift_range,
    format_time_12h,
)
from app.services.leave import AttendanceReconciliationService
from tests.conftest import make_user


class TestTimezoneAndShiftHelpers:
    def test_timezone_conversions(self):
        """Verify Asia/Kolkata conversions and day boundary calculations."""
        # 19:00 UTC on Sept 11 is 00:30 IST on Sept 12
        utc_dt = datetime(2026, 9, 11, 19, 0, 0, tzinfo=timezone.utc)
        ist_dt = to_ist(utc_dt)
        assert ist_dt.tzinfo == KOLKATA_TZ
        assert ist_dt.day == 12
        assert ist_dt.hour == 0
        assert ist_dt.minute == 30

        combined = combine_ist_datetime("2026-09-11", "09:00")
        assert combined.tzinfo == KOLKATA_TZ
        assert combined.year == 2026
        assert combined.month == 9
        assert combined.day == 11
        assert combined.hour == 9
        assert combined.minute == 0

    def test_parse_shift_string(self):
        """Verify shift string parsing handles various formats."""
        assert parse_shift_string("10:00 - 19:00") == ("10:00", "19:00")
        assert parse_shift_string("10:00-19:00") == ("10:00", "19:00")
        assert parse_shift_string("10:00 AM - 7:00 PM") == ("10:00", "19:00")
        assert parse_shift_string("20:00 - 05:00") == ("20:00", "05:00")
        assert parse_shift_string("09:00") == ("09:00", None)
        assert parse_shift_string(None) == (None, None)

    def test_format_shift_range(self):
        assert format_shift_range("09:00", "18:00") == "9:00 AM – 6:00 PM"
        assert format_shift_range("20:00", "05:00") == "8:00 PM – 5:00 AM"
        assert format_shift_range(None, None) is None


class TestAttendanceModelCalculations:
    def test_on_time_and_overtime_checkout(self):
        """Verify standard shift: on-time checkin, overtime checkout."""
        att = Attendance.model_construct(
            tenant_id="tenant_1",
            salon_id="tenant_1",
            staff_id="emp_1",
            date="2026-09-11",
            shift_start="09:00",
            shift_end="18:00",
            total_work_minutes=0,
            working_hours=0.0,
            overtime_minutes=0,
            early_leave_minutes=0,
        )
        # Check in at 09:00 IST (03:30 UTC), check out at 19:15 IST (13:45 UTC) -> 75m OT
        cin = datetime(2026, 9, 11, 3, 30, 0, tzinfo=timezone.utc)
        cout = datetime(2026, 9, 11, 13, 45, 0, tzinfo=timezone.utc)
        att.clock_in = cin
        att.status = ATTENDANCE_STATUS_PRESENT
        att.record_clock_out(cout)

        assert att.total_work_minutes == 615
        assert att.working_hours == 10.25
        assert att.overtime_minutes == 75
        assert att.early_leave_minutes == 0

    def test_early_leave_checkout(self):
        """Verify early checkout calculates early_leave_minutes and 0 overtime."""
        att = Attendance.model_construct(
            tenant_id="tenant_1",
            salon_id="tenant_1",
            staff_id="emp_1",
            date="2026-09-11",
            shift_start="09:00",
            shift_end="18:00",
            total_work_minutes=0,
            working_hours=0.0,
            overtime_minutes=0,
            early_leave_minutes=0,
        )
        # Check in at 09:00 IST (03:30 UTC), check out at 17:30 IST (12:00 UTC) -> 30m early
        cin = datetime(2026, 9, 11, 3, 30, 0, tzinfo=timezone.utc)
        cout = datetime(2026, 9, 11, 12, 0, 0, tzinfo=timezone.utc)
        att.clock_in = cin
        att.status = ATTENDANCE_STATUS_PRESENT
        att.record_clock_out(cout)

        assert att.total_work_minutes == 510
        assert att.working_hours == 8.5
        assert att.overtime_minutes == 0
        assert att.early_leave_minutes == 30

    def test_overnight_shift_checkout(self):
        """Verify overnight shift crossing midnight calculates overtime on next calendar day."""
        att = Attendance.model_construct(
            tenant_id="tenant_1",
            salon_id="tenant_1",
            staff_id="emp_1",
            date="2026-09-11",
            shift_start="20:00",
            shift_end="05:00",
            total_work_minutes=0,
            working_hours=0.0,
            overtime_minutes=0,
            early_leave_minutes=0,
        )
        # Check in at 20:00 IST (14:30 UTC), check out at 05:40 IST next day (00:10 UTC Sept 12) -> 40m OT
        cin = datetime(2026, 9, 11, 14, 30, 0, tzinfo=timezone.utc)
        cout = datetime(2026, 9, 12, 0, 10, 0, tzinfo=timezone.utc)
        att.clock_in = cin
        att.status = ATTENDANCE_STATUS_PRESENT
        att.record_clock_out(cout)

        assert att.total_work_minutes == 580
        assert att.overtime_minutes == 40
        assert att.early_leave_minutes == 0

    def test_late_and_overtime_coexist_independently(self):
        """Verify late check-in (30m) and overtime checkout (45m) do NOT cancel each other."""
        att = Attendance.model_construct(
            tenant_id="tenant_1",
            salon_id="tenant_1",
            staff_id="emp_1",
            date="2026-09-11",
            shift_start="10:00",
            shift_end="19:00",
            status=ATTENDANCE_STATUS_LATE,
            late_minutes=30,
            total_work_minutes=0,
            working_hours=0.0,
            overtime_minutes=0,
            early_leave_minutes=0,
        )
        # Check in at 10:30 IST (05:00 UTC), check out at 19:45 IST (14:15 UTC)
        cin = datetime(2026, 9, 11, 5, 0, 0, tzinfo=timezone.utc)
        cout = datetime(2026, 9, 11, 14, 15, 0, tzinfo=timezone.utc)
        att.clock_in = cin
        att.record_clock_out(cout)

        # Both remain recorded independently
        assert att.status == ATTENDANCE_STATUS_LATE
        assert att.late_minutes == 30
        assert att.overtime_minutes == 45
        assert att.total_work_minutes == 555


class TestAttendanceServiceBusinessRules:
    def test_compute_late_minutes(self):
        service = AttendanceService()

        # Check-in at 08:55 IST for 09:00 shift -> PRESENT, 0 late
        dt_on_time = datetime(2026, 9, 11, 3, 25, 0, tzinfo=timezone.utc)
        status_val, late_m = service._compute_late_minutes(dt_on_time, "2026-09-11", "09:00")
        assert status_val == ATTENDANCE_STATUS_PRESENT
        assert late_m == 0

        # Check-in at 09:35 IST for 09:00 shift -> LATE, 35 late
        dt_late = datetime(2026, 9, 11, 4, 5, 0, tzinfo=timezone.utc)
        status_val, late_m = service._compute_late_minutes(dt_late, "2026-09-11", "09:00")
        assert status_val == ATTENDANCE_STATUS_LATE
        assert late_m == 35

    def test_shift_resolution_hierarchy(self):
        service = AttendanceService()

        # 1. Staff assigned shift takes precedence
        user_with_shift = make_user("employee")
        user_with_shift.shift = "10:00 - 19:00"
        tenant = MagicMock(spec=Tenant)
        tenant.shift_start = "09:00"
        tenant.shift_end = "18:00"

        s_start, s_end, s_disp = service._resolve_shift(user_with_shift, tenant)
        assert s_start == "10:00"
        assert s_end == "19:00"
        assert s_disp == "10:00 AM – 7:00 PM"

        # 2. Salon default shift applies when staff has no assigned shift
        user_no_shift = make_user("employee")
        user_no_shift.shift = None
        user_no_shift.shift_start = None
        user_no_shift.shift_end = None

        s_start, s_end, s_disp = service._resolve_shift(user_no_shift, tenant)
        assert s_start == "09:00"
        assert s_end == "18:00"
        assert s_disp == "9:00 AM – 6:00 PM"

        # 3. Safe fallback when tenant has no shift
        s_start, s_end, s_disp = service._resolve_shift(user_no_shift, None)
        assert s_start == "09:00"
        assert s_end == "18:00"
        assert s_disp == "9:00 AM – 6:00 PM"

    @pytest.mark.asyncio
    async def test_late_notification_scope_and_deduplication(self):
        service = AttendanceService()
        record = Attendance.model_construct(
            id=ObjectId(),
            tenant_id="tenant_abc",
            salon_id="tenant_abc",
            staff_id="emp_late",
            date="2026-09-11",
            status=ATTENDANCE_STATUS_LATE,
            late_minutes=42,
            late_notified=False,
            branch_id="branch_1",
            clock_in=datetime(2026, 9, 11, 4, 12, 0, tzinfo=timezone.utc),
        )

        emp = make_user("employee", user_id="emp_late", tenant_id="tenant_abc")
        owner = make_user("salon_owner", user_id="owner_1", tenant_id="tenant_abc")
        mgr_same_branch = make_user("salon_manager", user_id="mgr_same", tenant_id="tenant_abc")
        mgr_same_branch.branch_id = "branch_1"
        mgr_diff_branch = make_user("salon_manager", user_id="mgr_diff", tenant_id="tenant_abc")
        mgr_diff_branch.branch_id = "branch_2"
        other_staff = make_user("employee", user_id="emp_other", tenant_id="tenant_abc")

        # Mock User.find to return candidate managers/owners
        mock_find_cursor = MagicMock()
        mock_find_cursor.to_list = AsyncMock(return_value=[owner, mgr_same_branch, mgr_diff_branch, other_staff])

        with patch.object(Attendance, "save", new_callable=AsyncMock) as mock_save:
            with patch("app.models.user.User.find", return_value=mock_find_cursor):
                with patch("app.services.attendance.notification_service.create_event_notifications", new_callable=AsyncMock) as mock_notify:
                    await service._send_late_notification(
                        tenant_id="tenant_abc",
                        employee=emp,
                        record=record,
                        shift_start="09:00",
                        shift_end="18:00",
                    )

            # Verified deduplication flag set
            assert record.late_notified is True
            mock_save.assert_called_once()

            # Verify recipients
            mock_notify.assert_called_once()
            _, kwargs = mock_notify.call_args
            recipients = kwargs.get("recipients", [])
            recipient_ids = [str(r.id) for r in recipients]

            assert "owner_1" in recipient_ids
            assert "mgr_same" in recipient_ids
            assert "mgr_diff" not in recipient_ids
            assert "emp_other" not in recipient_ids
            assert "emp_late" not in recipient_ids

            # Verify professional non-penalty message
            body = kwargs.get("body", "")
            assert "penalty" not in body.lower()
            assert "deduct" not in body.lower()
            assert "42 minutes late" in body

            # Verify deduplication: calling again does not notify
            mock_notify.reset_mock()
            await service._send_late_notification(
                tenant_id="tenant_abc",
                employee=emp,
                record=record,
                shift_start="09:00",
                shift_end="18:00",
            )
            mock_notify.assert_not_called()


class TestAutoAbsenceReconciliation:
    @pytest.mark.asyncio
    async def test_auto_absent_reconciliation_safeguards(self):
        recon = AttendanceReconciliationService()
        recon.attendance_repo = MagicMock()
        recon.leave_service = MagicMock()
        recon.leave_service._ensure_leave_attendance = AsyncMock()

        tenant = MagicMock(spec=Tenant)
        tenant.id = "tenant_abc"
        tenant.shift_start = "09:00"
        tenant.shift_end = "18:00"

        # 4 staff members:
        # emp_normal: unrecorded, no leave, not week off -> created as ABSENT
        # emp_weekoff: Friday is week off -> SKIPPED
        # emp_leave: approved leave on Friday -> SKIPPED
        # emp_overnight: has open session -> SKIPPED
        emp_normal = make_user("employee", user_id="emp_norm", tenant_id="tenant_abc")
        emp_normal.weekly_off = ["sunday"]

        emp_weekoff = make_user("employee", user_id="emp_wo", tenant_id="tenant_abc")
        emp_weekoff.weekly_off = ["friday"] # 2026-09-11 was Friday

        emp_leave = make_user("employee", user_id="emp_lv", tenant_id="tenant_abc")
        emp_leave.weekly_off = ["sunday"]

        emp_overnight = make_user("employee", user_id="emp_on", tenant_id="tenant_abc")
        emp_overnight.weekly_off = ["sunday"]

        staff_list = [emp_normal, emp_weekoff, emp_leave, emp_overnight]
        mock_user_find = MagicMock()
        mock_user_find.to_list = AsyncMock(return_value=staff_list)

        # attendance_repo mocks
        recon.attendance_repo.get_by_employee_and_date = AsyncMock(return_value=None)

        async def mock_open_session(salon_id, staff_id):
            if staff_id == "emp_on":
                mock_sess = MagicMock(spec=Attendance)
                mock_sess.date = "2026-09-11"
                return mock_sess
            return None
        recon.attendance_repo.get_open_session_for_employee = AsyncMock(side_effect=mock_open_session)

        # leave_service mock
        async def mock_get_leave(salon_id, staff_id, target_date):
            if staff_id == "emp_lv":
                return MagicMock()
            return None
        recon.leave_service.get_approved_leave_for_date = AsyncMock(side_effect=mock_get_leave)

        # mock _create_system_attendance
        created_records = []
        async def mock_create_system(tenant_id, user, date_str, status, source, notes, shift_start, shift_end):
            created_records.append({
                "staff_id": str(user.id),
                "status": status,
                "shift_start": shift_start,
                "shift_end": shift_end,
            })
            return MagicMock()
        recon._create_system_attendance = AsyncMock(side_effect=mock_create_system)

        with patch("app.models.user.User.find", return_value=mock_user_find):
            with patch("app.models.tenant.Tenant.get", new_callable=AsyncMock, return_value=tenant):
                with patch("app.services.leave.yesterday_ist_str", return_value="2026-09-11"):
                    count = await recon.reconcile_salon("tenant_abc")

        # 2 reconciled records: 1 auto-absent for unrecorded staff + 1 leave attendance for approved leave
        assert count == 2
        assert len(created_records) == 1
        created = created_records[0]
        assert created["staff_id"] == "emp_norm"
        assert created["status"] == ATTENDANCE_STATUS_ABSENT
        assert created["shift_start"] == "09:00"
        assert created["shift_end"] == "18:00"
        recon.leave_service._ensure_leave_attendance.assert_called_once()
