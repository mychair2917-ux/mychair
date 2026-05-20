from typing import List, Optional
from pydantic import Field, EmailStr
from app.models.base import BaseTenantDocument

class User(BaseTenantDocument):
    """
    Represents an authenticated user within a tenant.
    A user has credentials and is associated with a specific role.
    """
    email: EmailStr = Field(..., unique=True, index=True)
    hashed_password: str = Field(...)
    first_name: str = Field(..., max_length=50)
    last_name: str = Field(..., max_length=50)
    phone: Optional[str] = Field(default=None)
    
    # RBAC configuration
    role: str = Field(default="stylist")  # owner, manager, receptionist, stylist, system_admin
    is_active: bool = Field(default=True)
    
    # Devices / Refresh token tracking (for multi-device invalidate)
    refresh_token_version: int = Field(default=0)

    class Settings:
        name = "users"
        indexes = [
            "tenant_id",
            "email",
            "is_deleted",
        ]

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
