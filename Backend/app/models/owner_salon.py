from typing import Optional
from datetime import datetime
from beanie import Document
from pydantic import Field, EmailStr
from app.utils.timezone import now_utc


class OwnerSalon(Document):
    """
    Salon record created during the super-admin invitation flow.
    Separate from tenant-scoped Salon documents used inside tenant workspaces.
    """
    salon_name: str = Field(..., max_length=150)
    slug: str = Field(..., max_length=100)
    email: EmailStr = Field(...)
    username: str = Field(..., max_length=100)
    address: str = Field(default="")
    owner_id: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

    class Settings:
        name = "owner_salons"
        indexes = [
            "slug",
            "email",
            "owner_id",
        ]
