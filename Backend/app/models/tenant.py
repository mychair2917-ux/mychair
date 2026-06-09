from datetime import datetime
from typing import Optional
from beanie import Document
from pydantic import Field, EmailStr
from app.utils.timezone import now_utc

class Tenant(Document):
    """
    Global system-wide model representing a Salon ERP Tenant (SaaS customer).
    Since it is the root namespace of multi-tenancy, it is a global collection.
    """
    name: str = Field(..., max_length=100)
    slug: str = Field(..., unique=True, index=True)  # Used for subdomain or routing
    owner_email: EmailStr = Field(..., index=True)
    is_active: bool = Field(default=True)
    
    subscription_plan: str = Field(default="FREE")
    subscription_status: str = Field(default="ACTIVE")
    timezone: str = Field(default="UTC")
    currency: str = Field(default="USD")

    # Default attendance location (used when no branch Salon document exists)
    latitude: Optional[float] = Field(default=None)
    longitude: Optional[float] = Field(default=None)
    attendance_radius: int = Field(default=100, ge=10, le=5000)
    shift_start: str = Field(default="09:00", description="Default shift start HH:MM")

    # Legacy alias kept for existing clients
    subscription_tier: str = Field(default="FREE")

    created_by: Optional[str] = Field(default=None)
    updated_by: Optional[str] = Field(default=None)
    is_deleted: bool = Field(default=False)
    deleted_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

    class Settings:
        name = "tenants"
        indexes = [
            [("name", 1)],
            [("slug", 1)],
        ]
