from datetime import datetime
from typing import Optional

from pydantic import Field

from app.models.base import BaseTenantDocument
from app.utils.timezone import now_utc


class AttendanceLog(BaseTenantDocument):
    """Audit trail for attendance changes."""

    attendance_id: str = Field(..., index=True)
    action_type: str = Field(..., index=True)
    action_by: str = Field(...)
    old_value: Optional[str] = Field(default=None)
    new_value: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=now_utc)

    class Settings:
        name = "attendance_logs"
        indexes = [
            [("tenant_id", 1), ("attendance_id", 1)],
            "is_deleted",
        ]
