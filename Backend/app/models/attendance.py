from datetime import datetime
from typing import Optional
from pydantic import Field
from app.models.base import BaseTenantDocument
from app.utils.timezone import now_utc

class Attendance(BaseTenantDocument):
    """
    Tracks daily stylist attendance, clock-ins, clock-outs, and leaves.
    Feeds directly into payroll calculations.
    """
    staff_id: str = Field(..., index=True)
    salon_id: str = Field(..., index=True)
    
    date: str = Field(..., index=True)  # Format: "YYYY-MM-DD"
    status: str = Field(default="PRESENT", index=True)  # PRESENT, ABSENT, LATE, LEAVE
    
    clock_in: Optional[datetime] = Field(default=None)
    clock_out: Optional[datetime] = Field(default=None)
    
    working_hours: float = Field(default=0.0)  # Calculated on clock-out
    notes: Optional[str] = Field(default=None)

    class Settings:
        name = "attendance"
        indexes = [
            [("tenant_id", 1), ("staff_id", 1), ("date", 1)],
            "is_deleted",
        ]

    def record_clock_out(self, clock_out_time: datetime) -> None:
        """Calculates working hours dynamically upon clock out."""
        self.clock_out = clock_out_time
        if self.clock_in:
            duration = clock_out_time - self.clock_in
            self.working_hours = round(duration.total_seconds() / 3600.0, 2)
