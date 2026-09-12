from datetime import datetime, timedelta
from typing import Optional

from pydantic import Field

from app.constants.attendance_options import (
    ATTENDANCE_METHOD_LOCATION,
    ATTENDANCE_STATUS_PRESENT,
)
from app.models.base import BaseTenantDocument
from app.utils.timezone import KOLKATA_TZ, combine_ist_datetime, make_aware, to_ist


class Attendance(BaseTenantDocument):
    """
    Tracks daily staff attendance with geolocation validation, shift snapshot, and audit support.
    """

    staff_id: str = Field(..., index=True)
    branch_id: Optional[str] = Field(default=None, index=True)
    salon_id: str = Field(..., index=True)

    date: str = Field(..., index=True)
    status: str = Field(default=ATTENDANCE_STATUS_PRESENT, index=True)

    clock_in: Optional[datetime] = Field(default=None)
    clock_out: Optional[datetime] = Field(default=None)

    # Shift timing snapshot for historical accuracy
    shift_start: Optional[str] = Field(default=None)
    shift_end: Optional[str] = Field(default=None)

    late_minutes: int = Field(default=0, ge=0)
    overtime_minutes: int = Field(default=0, ge=0)
    early_leave_minutes: int = Field(default=0, ge=0)
    total_work_minutes: int = Field(default=0, ge=0)
    working_hours: float = Field(default=0.0)

    # Duplicate late notification prevention
    late_notified: bool = Field(default=False)

    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    distance_from_branch: Optional[float] = Field(default=None)

    attendance_method: str = Field(default=ATTENDANCE_METHOD_LOCATION)
    source: Optional[str] = Field(default=None, index=True)
    notes: Optional[str] = Field(default=None)

    class Settings:
        name = "attendance"
        indexes = [
            [("tenant_id", 1), ("staff_id", 1), ("date", 1)],
            [("tenant_id", 1), ("branch_id", 1), ("date", 1)],
            [("tenant_id", 1), ("date", 1)],
            "is_deleted",
        ]

    def record_clock_out(
        self,
        clock_out_time: datetime,
        shift_end: Optional[str] = None,
        shift_start: Optional[str] = None,
    ) -> None:
        """Calculate worked time, overtime, and early leave when employee checks out."""
        checkout = make_aware(clock_out_time)
        self.clock_out = checkout

        effective_shift_start = shift_start or self.shift_start
        effective_shift_end = shift_end or self.shift_end
        if effective_shift_start and not self.shift_start:
            self.shift_start = effective_shift_start
        if effective_shift_end and not self.shift_end:
            self.shift_end = effective_shift_end

        if self.clock_in:
            checkin = make_aware(self.clock_in)
            duration = checkout - checkin
            minutes = int(duration.total_seconds() // 60)
            self.total_work_minutes = max(minutes, 0)
            self.working_hours = round(self.total_work_minutes / 60.0, 2)

        # Overtime calculation: checkout - scheduled shift end
        if effective_shift_end and self.date:
            try:
                checkout_ist = to_ist(checkout)
                scheduled_end_dt = combine_ist_datetime(self.date, effective_shift_end)

                # If overnight shift (end time <= start time), shift end is on the following calendar day
                if effective_shift_start and effective_shift_end <= effective_shift_start:
                    scheduled_end_dt = scheduled_end_dt + timedelta(days=1)

                if checkout_ist > scheduled_end_dt:
                    ot_seconds = (checkout_ist - scheduled_end_dt).total_seconds()
                    self.overtime_minutes = max(0, int(ot_seconds // 60))
                    self.early_leave_minutes = 0
                else:
                    self.overtime_minutes = 0
                    early_seconds = (scheduled_end_dt - checkout_ist).total_seconds()
                    self.early_leave_minutes = max(0, int(early_seconds // 60))
            except Exception:
                self.overtime_minutes = 0
                self.early_leave_minutes = 0
        else:
            self.overtime_minutes = 0
            self.early_leave_minutes = 0
