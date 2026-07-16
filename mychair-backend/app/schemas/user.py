from typing import List, Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models.permissions import VALID_ROLES


class UserCreate(BaseModel):
    email: EmailStr
    phone: str
    password: str = Field(..., min_length=8)
    role: str
    permissions: List[str] = Field(default_factory=list)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    employee_id: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: str) -> str:
        if v not in VALID_ROLES:
            raise ValueError(f"role must be one of {sorted(VALID_ROLES)}")
        return v


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = Field(default=None, min_length=8)
    role: Optional[str] = None
    permissions: Optional[List[str]] = None
    is_active: Optional[bool] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    employee_id: Optional[str] = None

    @field_validator("role")
    @classmethod
    def validate_role(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in VALID_ROLES:
            raise ValueError(f"role must be one of {sorted(VALID_ROLES)}")
        return v


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    phone: str
    role: str
    permissions: List[str]
    is_active: bool
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    employee_id: Optional[str] = None
    tenant_id: str
