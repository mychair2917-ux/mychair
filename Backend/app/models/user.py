from typing import List, Optional
from datetime import datetime
from pydantic import Field, EmailStr
from app.models.base import BaseTenantDocument


class User(BaseTenantDocument):
    """
    Authenticated user within a tenant. Credentials and RBAC role are stored here.
    Uniqueness of email and phone is enforced per tenant via compound indexes.
    """
    email: EmailStr = Field(..., index=True)
    phone: Optional[str] = Field(default=None, index=True)
    hashed_password: str = Field(...)
    role: str = Field(
        default="employee",
        description="One of: super_admin, salon_owner, salon_admin, salon_manager, employee",
    )
    status: str = Field(
        default="ACTIVE",
        description="ACTIVE or INACTIVE"
    )
    permissions: List[str] = Field(default_factory=list)
    employee_id: Optional[str] = Field(default=None, index=True)
    is_active: bool = Field(default=True)
    last_login: Optional[datetime] = Field(default=None)
    refresh_token_version: int = Field(default=0)

    # Optional display names (not required for auth)
    first_name: Optional[str] = Field(default=None, max_length=50)
    last_name: Optional[str] = Field(default=None, max_length=50)
    alternate_phone: Optional[str] = Field(default=None, max_length=20)
    gender: Optional[str] = Field(default=None, max_length=20)
    dob: Optional[datetime] = Field(default=None)
    avatar: Optional[str] = Field(default=None, max_length=500)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    country: Optional[str] = Field(default=None, max_length=100)
    pincode: Optional[str] = Field(default=None, max_length=20)
    department: Optional[str] = Field(default=None, max_length=100)
    designation: Optional[str] = Field(default=None, max_length=100)
    shift: Optional[str] = Field(default=None, max_length=100)
    branch_id: Optional[str] = Field(default=None, index=True)
    employee_code: Optional[str] = Field(default=None, max_length=50, index=True)

    # Salon owner invitation / profile (role=salon_owner)
    username: Optional[str] = Field(default=None, max_length=100)
    salon_name: Optional[str] = Field(default=None, max_length=150)
    salon_phone_number: Optional[str] = Field(default=None, max_length=20)
    salon_type: Optional[str] = Field(default=None, max_length=50)
    branch_name: Optional[str] = Field(default=None, max_length=150)
    subscription_plan: Optional[str] = Field(default=None, max_length=50)
    address: Optional[str] = Field(default=None, max_length=500)

    # Payroll / salary configuration (managers & staff)
    salary: float = Field(default=0.0, ge=0.0)
    salary_type: str = Field(
        default="monthly",
        description="One of: monthly, daily, weekly",
    )
    joining_date: Optional[datetime] = Field(default=None)
    incentive_base: bool = Field(default=False)
    service_incentive_percent: float = Field(default=0.0, ge=0.0)
    product_incentive_percent: float = Field(default=0.0, ge=0.0)

    # Weekly off days for attendance (e.g. ["sunday", "monday"])
    weekly_off: List[str] = Field(default_factory=list)

    class Settings:
        name = "users"
        indexes = [
            [("tenant_id", 1), ("email", 1)],
            [("tenant_id", 1), ("phone", 1)],
            [("tenant_id", 1), ("employee_id", 1)],
            [("tenant_id", 1), ("employee_code", 1)],
            [("tenant_id", 1), ("branch_id", 1)],
            "is_deleted",
        ]
