from datetime import datetime
from typing import Optional

from pydantic import Field

from app.constants.leave_options import LEAVE_STATUS_PENDING
from app.models.base import BaseTenantDocument


class LeaveRequest(BaseTenantDocument):
    """Salon-scoped leave request submitted by staff."""

    salon_id: str = Field(..., index=True)
    employee_id: str = Field(..., index=True)
    employee_name: str = Field(...)
    employee_role: str = Field(...)
    leave_date: str = Field(..., index=True, description="YYYY-MM-DD")
    leave_reason: str = Field(...)
    status: str = Field(default=LEAVE_STATUS_PENDING, index=True)
    approved_by: Optional[str] = Field(default=None)
    approved_at: Optional[datetime] = Field(default=None)
    rejection_reason: Optional[str] = Field(default=None)

    class Settings:
        name = "leave_requests"
        indexes = [
            [("tenant_id", 1), ("employee_id", 1), ("leave_date", 1)],
            [("tenant_id", 1), ("status", 1), ("leave_date", 1)],
            "is_deleted",
        ]
