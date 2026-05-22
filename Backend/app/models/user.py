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
        description="One of: super_admin, salon_admin, salon_manager, employee",
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

    class Settings:
        name = "users"
        indexes = [
            [("tenant_id", 1), ("email", 1)],
            [("tenant_id", 1), ("phone", 1)],
            "is_deleted",
        ]
