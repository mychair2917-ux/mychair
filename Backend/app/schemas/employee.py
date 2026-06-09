from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


class EmployeeListItem(BaseModel):
    id: str
    full_name: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    role: str
    email: EmailStr
    phone: Optional[str] = None
    branch_name: Optional[str] = None
    salon_id: Optional[str] = None
    status: str
    is_active: bool
    created_at: datetime
    weekly_off: List[str] = Field(default_factory=list)


class SalonEmployeeGroup(BaseModel):
    salon_id: str
    salon_name: Optional[str] = None
    branch_name: Optional[str] = None
    managers: List[EmployeeListItem] = []
    staff: List[EmployeeListItem] = []


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, max_length=50)
    last_name: Optional[str] = Field(default=None, max_length=50)
    phone: Optional[str] = Field(default=None, max_length=20)
    role: Optional[str] = None
    branch_name: Optional[str] = Field(default=None, max_length=150)
    is_active: Optional[bool] = None
    weekly_off: Optional[List[str]] = None

    @field_validator("weekly_off")
    @classmethod
    def validate_weekly_off(cls, value: Optional[List[str]]) -> Optional[List[str]]:
        if value is None:
            return None
        from app.utils.week_off import normalize_week_days

        return normalize_week_days(value)


class EmployeeStatusUpdate(BaseModel):
    is_active: bool


class EmployeeResetPassword(BaseModel):
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

