from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


class EmployeeListItem(BaseModel):
    id: str
    full_name: str
    role: str
    email: EmailStr
    phone: Optional[str] = None
    branch_name: Optional[str] = None
    status: str
    is_active: bool
    created_at: datetime


class EmployeeUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, max_length=50)
    last_name: Optional[str] = Field(default=None, max_length=50)
    phone: Optional[str] = Field(default=None, max_length=20)
    role: Optional[str] = None
    branch_name: Optional[str] = Field(default=None, max_length=150)
    is_active: Optional[bool] = None


class EmployeeStatusUpdate(BaseModel):
    is_active: bool


class EmployeeResetPassword(BaseModel):
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)
