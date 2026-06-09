from datetime import datetime
from typing import Optional

from pydantic import Field

from app.constants.attendance_options import (
    ATTENDANCE_METHOD_LOCATION,
    ATTENDANCE_STATUS_PRESENT,
)
from app.models.base import BaseTenantDocument
from app.utils.timezone import make_aware


class Attendance(BaseTenantDocument):
    """
    Tracks daily staff attendance with geolocation validation and audit support.
    """

    staff_id: str = Field(..., index=True)
    branch_id: Optional[str] = Field(default=None, index=True)
    salon_id: str = Field(..., index=True)

    date: str = Field(..., index=True)
    status: str = Field(default=ATTENDANCE_STATUS_PRESENT, index=True)

    clock_in: Optional[datetime] = Field(default=None)
    clock_out: Optional[datetime] = Field(default=None)

    late_minutes: int = Field(default=0, ge=0)
    total_work_minutes: int = Field(default=0, ge=0)
    working_hours: float = Field(default=0.0)

    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    distance_from_branch: Optional[float] = Field(default=None)

    attendance_method: str = Field(default=ATTENDANCE_METHOD_LOCATION)
    notes: Optional[str] = Field(default=None)

    class Settings:
        name = "attendance"
        indexes = [
            [("tenant_id", 1), ("staff_id", 1), ("date", 1)],
            [("tenant_id", 1), ("branch_id", 1), ("date", 1)],
            [("tenant_id", 1), ("date", 1)],
            "is_deleted",
        ]

    def record_clock_out(self, clock_out_time: datetime) -> None:
        """Calculate worked time when employee checks out."""
        checkout = make_aware(clock_out_time)
        self.clock_out = checkout
        if self.clock_in:
            checkin = make_aware(self.clock_in)
            duration = checkout - checkin
            minutes = int(duration.total_seconds() // 60)
            self.total_work_minutes = max(minutes, 0)
            self.working_hours = round(self.total_work_minutes / 60.0, 2)
