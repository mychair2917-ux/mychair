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
    
    subscription_tier: str = Field(default="FREE")  # FREE, BASIC, PREMIUM, ENTERPRISE
    subscription_status: str = Field(default="ACTIVE")  # ACTIVE, SUSPENDED, TRIAL_EXPIRED
    
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

    class Settings:
        name = "tenants"
