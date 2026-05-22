from typing import Optional
from datetime import datetime
from beanie import Document
from pydantic import Field, EmailStr
from app.utils.timezone import now_utc


class SalonOwner(Document):
    """Salon owner account created via the invitation flow."""
    email: EmailStr = Field(..., index=True)
    username: str = Field(..., max_length=100)
    password_hash: Optional[str] = Field(default=None)
    role: str = Field(default="salon_owner")
    is_active: bool = Field(default=False)
    invitation_accepted: bool = Field(default=False)
    salon_id: Optional[str] = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)

    class Settings:
        name = "salon_owners"
        indexes = [
            "email",
            "username",
            "salon_id",
        ]
