from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from app.constants.attendance_options import ATTENDANCE_STATUSES


class LocationPayload(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


class CheckInRequest(LocationPayload):
    pass


class CheckOutRequest(LocationPayload):
    pass


class ManualAttendanceUpdate(BaseModel):
    attendance_id: str
    status: Optional[str] = Field(default=None)
    check_in_time: Optional[datetime] = Field(default=None)
    check_out_time: Optional[datetime] = Field(default=None)
    notes: Optional[str] = Field(default=None, max_length=500)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in ATTENDANCE_STATUSES:
            raise ValueError(f"status must be one of {ATTENDANCE_STATUSES}")
        return value


class AttendanceItem(BaseModel):
    id: str
    employee_id: str
    employee_name: str
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    attendance_date: str
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    status: str
    late_minutes: int = 0
    total_work_minutes: int = 0
    total_hours: float = 0.0
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    distance_from_branch: Optional[float] = None
    attendance_method: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class TodayAttendanceStatus(BaseModel):
    attendance_date: str
    shift_timing: Optional[str] = None
    status: Optional[str] = None
    check_in_time: Optional[datetime] = None
    check_out_time: Optional[datetime] = None
    total_work_minutes: int = 0
    total_hours: float = 0.0
    can_check_in: bool = True
    can_check_out: bool = False
    is_checked_in: bool = False
    is_checked_out: bool = False
    location_required: bool = True
    branch_configured: bool = False


class PaginatedAttendance(BaseModel):
    items: List[AttendanceItem]
    total: int
    page: int
    limit: int
    pages: int


class BranchLocationUpdate(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    attendance_radius: int = Field(default=100, ge=10, le=5000)
    branch_id: Optional[str] = Field(default=None)
    shift_start: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")


class AttendanceSummary(BaseModel):
    present_count: int = 0
    late_count: int = 0
    absent_count: int = 0
    week_off_count: int = 0
    half_day_count: int = 0
    total_records: int = 0
    total_work_hours: float = 0.0


class BranchLocationResponse(BaseModel):
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    attendance_radius: int = 100
    shift_start: str = "09:00"
    is_configured: bool = False
