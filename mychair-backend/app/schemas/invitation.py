import re
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.auth.invitation_rbac import (
    ROLE_EMPLOYEE,
    ROLE_SALON_MANAGER,
    ROLE_SALON_OWNER,
    ROLES_REQUIRING_SALON_SETUP,
    ROLES_REQUIRING_TENANT,
)
from app.constants.invitation_options import VALID_SALON_TYPE_VALUES
from app.constants.subscription_options import (
    VALID_SUBSCRIPTION_PLAN_VALUES,
    normalize_plan_name,
)
from app.constants.payroll_options import VALID_SALARY_TYPE_VALUES

PHONE_PATTERN = re.compile(r"^\+?[0-9]{7,15}$")
INVITE_ROLES = {ROLE_SALON_OWNER, ROLE_SALON_MANAGER, ROLE_EMPLOYEE}


class CreateInviteRequest(BaseModel):
    role: str = Field(..., min_length=1, max_length=50)
    full_name: str = Field(..., min_length=2, max_length=150)
    email: Optional[EmailStr] = Field(default=None)
    phone: str = Field(default="", max_length=20)
    password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    confirm_password: Optional[str] = Field(default=None, min_length=8, max_length=128)
    username: Optional[str] = Field(default=None, min_length=3, max_length=100)

    tenant_id: Optional[str] = Field(default=None, description="Required for manager/staff when inviter is super admin")

    branch_id: Optional[str] = Field(default=None)
    branch_name: str = Field(default="", max_length=150)
    reporting_manager_id: Optional[str] = Field(default=None)

    salon_name: Optional[str] = Field(default=None, max_length=150)
    salon_type: Optional[str] = Field(default=None, max_length=50)
    subscription_plan: Optional[str] = Field(default=None, max_length=50)
    trial_start_date: Optional[datetime] = Field(default=None)
    salon_phone_number: str = Field(default="", max_length=20)
    address: str = Field(default="", max_length=500)
    gst_number: str = Field(default="", max_length=20)
    slug: Optional[str] = Field(default=None, min_length=2, max_length=100, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

    # Attendance location (salon owner onboarding)
    latitude: Optional[float] = Field(default=None, ge=-90, le=90)
    longitude: Optional[float] = Field(default=None, ge=-180, le=180)
    attendance_radius: int = Field(default=100, ge=10, le=5000)
    shift_start: Optional[str] = Field(default=None, pattern=r"^\d{2}:\d{2}$")

    # Payroll / salary configuration (manager & staff)
    salary: Optional[float] = Field(default=None, ge=0.0)
    salary_type: Optional[str] = Field(default=None)
    joining_date: Optional[datetime] = Field(default=None)
    incentive_base: Optional[bool] = Field(default=False)
    service_incentive_percent: Optional[float] = Field(default=None, ge=0.0)
    product_incentive_percent: Optional[float] = Field(default=None, ge=0.0)

    weekly_off: List[str] = Field(default_factory=list)

    @field_validator("weekly_off")
    @classmethod
    def validate_weekly_off(cls, value: List[str]) -> List[str]:
        from app.utils.week_off import normalize_week_days

        return normalize_week_days(value or [])

    @field_validator("salary_type")
    @classmethod
    def validate_salary_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not str(value).strip():
            return None
        normalized = str(value).strip().lower()
        if normalized not in VALID_SALARY_TYPE_VALUES:
            raise ValueError("Please select a valid salary type")
        return normalized

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in INVITE_ROLES:
            raise ValueError("Invalid invitation role")
        return normalized

    @field_validator("phone", "salon_phone_number")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            return ""
        if not PHONE_PATTERN.match(cleaned):
            raise ValueError("Enter a valid phone number (7–15 digits, optional + prefix)")
        return cleaned

    @field_validator("salon_type")
    @classmethod
    def validate_salon_type(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not str(value).strip():
            return None
        normalized = str(value).strip().lower()
        if normalized not in VALID_SALON_TYPE_VALUES:
            raise ValueError("Please select a valid salon type")
        return normalized

    @field_validator("subscription_plan")
    @classmethod
    def validate_subscription_plan(cls, value: Optional[str]) -> Optional[str]:
        if value is None or not str(value).strip():
            return None
        normalized = normalize_plan_name(str(value))
        if normalized not in VALID_SUBSCRIPTION_PLAN_VALUES:
            raise ValueError("Please select a valid subscription plan")
        return normalized

    @model_validator(mode="after")
    def validate_role_fields(self) -> "CreateInviteRequest":
        if self.role in ROLES_REQUIRING_SALON_SETUP:
            missing = []
            if not self.email:
                missing.append("email")
            if not self.salon_name or len(self.salon_name.strip()) < 2:
                missing.append("salon_name")
            if not self.salon_type:
                missing.append("salon_type")
            if not self.subscription_plan:
                missing.append("subscription_plan")
            if self.latitude is None or self.longitude is None:
                missing.append("location")
            if missing:
                raise ValueError(f"Salon owner invitations require: {', '.join(missing)}")
            return self

        # Manager / staff roles require salary configuration
        salary_missing = []
        if self.salary is None:
            salary_missing.append("salary")
        if not self.salary_type:
            salary_missing.append("salary_type")
        if self.joining_date is None:
            salary_missing.append("joining_date")
        if salary_missing:
            raise ValueError(
                f"Employee salary setup requires: {', '.join(salary_missing)}"
            )
        if self.incentive_base:
            incentive_missing = []
            if self.service_incentive_percent is None:
                incentive_missing.append("service_incentive_percent")
            if self.product_incentive_percent is None:
                incentive_missing.append("product_incentive_percent")
            if incentive_missing:
                raise ValueError(
                    f"Incentive-based employees require: {', '.join(incentive_missing)}"
                )

        if self.password and self.confirm_password and self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self


class CreateInvitationRequest(BaseModel):
    """Legacy salon-owner-only payload (backward compatible)."""

    salon_name: str = Field(..., min_length=2, max_length=150)
    owner_full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    owner_phone_number: str = Field(default="", max_length=20)
    salon_phone_number: str = Field(default="", max_length=20)
    salon_type: str = Field(..., min_length=1, max_length=50)
    branch_name: str = Field(default="", max_length=150)
    address: str = Field(default="", max_length=500)
    subscription_plan: str = Field(..., min_length=1, max_length=50)
    slug: Optional[str] = Field(default=None, min_length=2, max_length=100, pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
    username: Optional[str] = Field(default=None, min_length=3, max_length=100)

    @field_validator("owner_phone_number", "salon_phone_number")
    @classmethod
    def validate_phone(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            return ""
        if not PHONE_PATTERN.match(cleaned):
            raise ValueError("Enter a valid phone number (7–15 digits, optional + prefix)")
        return cleaned

    @field_validator("salon_type")
    @classmethod
    def validate_salon_type(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in VALID_SALON_TYPE_VALUES:
            raise ValueError("Please select a valid salon type")
        return normalized

    @field_validator("subscription_plan")
    @classmethod
    def validate_subscription_plan(cls, value: str) -> str:
        normalized = normalize_plan_name(value)
        if normalized not in VALID_SUBSCRIPTION_PLAN_VALUES:
            raise ValueError("Please select a valid subscription plan")
        return normalized


class InviteTokenRequest(BaseModel):
    token: str = Field(..., min_length=10)


class CreatePasswordRequest(BaseModel):
    token: str = Field(..., min_length=10)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)


class AcceptInviteRequest(BaseModel):
    token: str = Field(..., min_length=10)
    password: str = Field(..., min_length=8, max_length=128)
    confirm_password: str = Field(..., min_length=8, max_length=128)


class ResendInviteRequest(BaseModel):
    invite_id: str = Field(..., min_length=1)


class CancelInviteRequest(BaseModel):
    invite_id: str = Field(..., min_length=1)


class SalonOwnerLoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class TeamLoginRequest(BaseModel):
    phone: str = Field(..., min_length=7, max_length=20)
    password: str = Field(..., min_length=1)


class InviteListItem(BaseModel):
    id: str
    invited_email: str
    full_name: str
    role: str
    status: str
    salon_id: Optional[str] = None
    salon_name: Optional[str] = None
    branch_name: Optional[str] = None
    subscription_plan: Optional[str] = None
    expires_at: str
    created_at: str
    accepted_at: Optional[str] = None
    resend_count: int = 0


class InviteFormOptionsResponse(BaseModel):
    invitable_roles: List[dict]
    salon_types: List[dict]
    subscription_plans: List[dict]
    tenants: List[dict] = Field(default_factory=list)
    branches: List[dict] = Field(default_factory=list)
    managers: List[dict] = Field(default_factory=list)
