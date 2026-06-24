from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from app.constants.leave_options import LEAVE_STATUSES


class LeaveApplyRequest(BaseModel):
    leave_date: str = Field(..., description="YYYY-MM-DD")
    leave_reason: str = Field(..., min_length=1, max_length=1000)


class LeaveRejectRequest(BaseModel):
    rejection_reason: Optional[str] = Field(default=None, max_length=500)


class LeaveItem(BaseModel):
    id: str
    salon_id: str
    employee_id: str
    employee_name: str
    employee_role: str
    leave_date: str
    leave_reason: str
    status: str
    approved_by: Optional[str] = None
    approved_by_name: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class PaginatedLeaveRequests(BaseModel):
    items: List[LeaveItem]
    total: int
    page: int
    limit: int
    pages: int


class LeaveListParams(BaseModel):
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)
    search: Optional[str] = None
    status: Optional[str] = None
    date_from: Optional[str] = None
    date_to: Optional[str] = None
    employee_id: Optional[str] = None
    salon_id: Optional[str] = None

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in LEAVE_STATUSES:
            raise ValueError(f"status must be one of {LEAVE_STATUSES}")
        return value
