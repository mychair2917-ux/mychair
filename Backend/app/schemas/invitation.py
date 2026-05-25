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
from app.constants.invitation_options import (
    VALID_SALON_TYPE_VALUES,
    VALID_SUBSCRIPTION_PLAN_VALUES,
)

PHONE_PATTERN = re.compile(r"^\+?[0-9]{7,15}$")
INVITE_ROLES = {ROLE_SALON_OWNER, ROLE_SALON_MANAGER, ROLE_EMPLOYEE}


class CreateInviteRequest(BaseModel):
    role: str = Field(..., min_length=1, max_length=50)
    full_name: str = Field(..., min_length=2, max_length=150)
    email: EmailStr
    phone: str = Field(default="", max_length=20)

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
    username: Optional[str] = Field(default=None, min_length=3, max_length=100)

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
        normalized = str(value).strip().upper()
        if normalized not in VALID_SUBSCRIPTION_PLAN_VALUES:
            raise ValueError("Please select a valid subscription plan")
        return normalized

    @model_validator(mode="after")
    def validate_role_fields(self) -> "CreateInviteRequest":
        if self.role in ROLES_REQUIRING_SALON_SETUP:
            missing = []
            if not self.salon_name or len(self.salon_name.strip()) < 2:
                missing.append("salon_name")
            if not self.salon_type:
                missing.append("salon_type")
            if not self.subscription_plan:
                missing.append("subscription_plan")
            if missing:
                raise ValueError(f"Salon owner invitations require: {', '.join(missing)}")
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
        normalized = value.strip().upper()
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
