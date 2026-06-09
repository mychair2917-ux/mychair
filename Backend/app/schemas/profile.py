from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator


PROFILE_GENDERS = {"male", "female", "other", "prefer_not_to_say"}
PROFILE_ADMIN_ROLES = {"super_admin", "salon_owner", "salon_admin"}


def _normalize_phone(value: Optional[str]) -> Optional[str]:
    if value is None:
        return None
    cleaned = value.strip()
    return cleaned or None


def _validate_phone(value: Optional[str], field_name: str) -> Optional[str]:
    normalized = _normalize_phone(value)
    if normalized is None:
        return None
    digits = "".join(ch for ch in normalized if ch.isdigit())
    if len(digits) < 7 or len(digits) > 15:
        raise ValueError(f"{field_name} must contain 7 to 15 digits")
    return normalized


class ProfileResponse(BaseModel):
    id: str
    tenant_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    full_name: str
    email: EmailStr
    phone: Optional[str] = None
    alternate_phone: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[datetime] = None
    avatar: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    pincode: Optional[str] = None
    role: str
    department: Optional[str] = None
    designation: Optional[str] = None
    branch_id: Optional[str] = None
    branch_name: Optional[str] = None
    salon_name: Optional[str] = None
    shift: Optional[str] = None
    joining_date: Optional[datetime] = None
    employee_id: Optional[str] = None
    employee_code: Optional[str] = None
    last_login: Optional[datetime] = None
    status: str
    is_active: bool
    updated_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    can_edit_professional_info: bool = False
    can_change_password: bool = True
    can_manage_avatar: bool = True
    permissions: Dict[str, bool] = Field(default_factory=dict)


class ProfileUpdateRequest(BaseModel):
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(default=None, min_length=7, max_length=20)
    alternate_phone: Optional[str] = Field(default=None, max_length=20)
    gender: Optional[str] = Field(default=None, max_length=20)
    dob: Optional[datetime] = None
    address: Optional[str] = Field(default=None, max_length=500)
    city: Optional[str] = Field(default=None, max_length=100)
    state: Optional[str] = Field(default=None, max_length=100)
    country: Optional[str] = Field(default=None, max_length=100)
    pincode: Optional[str] = Field(default=None, max_length=20)
    department: Optional[str] = Field(default=None, max_length=100)
    designation: Optional[str] = Field(default=None, max_length=100)
    shift: Optional[str] = Field(default=None, max_length=100)
    branch_id: Optional[str] = None
    branch_name: Optional[str] = Field(default=None, max_length=150)
    employee_code: Optional[str] = Field(default=None, max_length=50)
    joining_date: Optional[datetime] = None
    status: Optional[str] = Field(default=None, max_length=20)
    is_active: Optional[bool] = None

    @field_validator("first_name", "last_name", "address", "city", "state", "country", "pincode", "department", "designation", "shift", "branch_name", "employee_code", mode="before")
    @classmethod
    def strip_strings(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("email", mode="before")
    @classmethod
    def strip_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = str(value).strip()
        return stripped or None

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        validated = _validate_phone(value, "phone")
        if validated is None:
            raise ValueError("phone is required")
        return validated

    @field_validator("alternate_phone")
    @classmethod
    def validate_alternate_phone(cls, value: Optional[str]) -> Optional[str]:
        return _validate_phone(value, "alternate_phone")

    @field_validator("gender")
    @classmethod
    def validate_gender(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().lower()
        if normalized not in PROFILE_GENDERS:
            raise ValueError("gender must be one of male, female, other, prefer_not_to_say")
        return normalized

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        normalized = value.strip().upper()
        if normalized not in {"ACTIVE", "INACTIVE"}:
            raise ValueError("status must be ACTIVE or INACTIVE")
        return normalized

    @model_validator(mode="after")
    def ensure_distinct_phones(self) -> "ProfileUpdateRequest":
        if (
            self.phone
            and self.alternate_phone
            and self.phone.strip() == self.alternate_phone.strip()
        ):
            raise ValueError("alternate_phone must be different from phone")
        return self

    @model_validator(mode="after")
    def ensure_at_least_one_field(self) -> "ProfileUpdateRequest":
        if not self.model_dump(exclude_unset=True):
            raise ValueError("At least one profile field must be provided")
        return self


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=8)
    new_password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., min_length=8)

    @model_validator(mode="after")
    def validate_passwords(self) -> "ChangePasswordRequest":
        if self.new_password != self.confirm_password:
            raise ValueError("confirm_password must match new_password")
        if self.current_password == self.new_password:
            raise ValueError("new_password must be different from current_password")
        return self


class AvatarRemoveRequest(BaseModel):
    remove: bool = True


class AvatarUploadResponse(BaseModel):
    avatar: Optional[str] = None

