from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import EmailStr, Field

from app.utils.timezone import now_utc


class Invite(Document):
    """Role-based user invitation with lifecycle tracking."""

    invited_by: str = Field(..., index=True)
    invited_email: EmailStr = Field(..., index=True)
    role: str = Field(..., index=True)
    full_name: str = Field(..., max_length=150)
    phone: Optional[str] = Field(default=None, max_length=20)

    salon_id: Optional[str] = Field(default=None, index=True)
    branch_id: Optional[str] = Field(default=None)
    branch_name: Optional[str] = Field(default=None, max_length=150)
    reporting_manager_id: Optional[str] = Field(default=None)

    token: str = Field(..., index=True)
    expires_at: datetime = Field(...)
    status: str = Field(
        default="pending",
        description="pending | accepted | expired | cancelled",
    )

    subscription_plan: Optional[str] = Field(default=None, max_length=50)
    trial_start_date: Optional[datetime] = Field(default=None)
    salon_name: Optional[str] = Field(default=None, max_length=150)
    salon_type: Optional[str] = Field(default=None, max_length=50)
    salon_phone_number: Optional[str] = Field(default=None, max_length=20)
    address: Optional[str] = Field(default=None, max_length=500)
    gst_number: Optional[str] = Field(default=None, max_length=20)

    user_id: Optional[str] = Field(default=None, index=True)
    resend_count: int = Field(default=0)
    created_at: datetime = Field(default_factory=now_utc)
    accepted_at: Optional[datetime] = Field(default=None)

    class Settings:
        name = "invites"
        indexes = [
            "token",
            "invited_email",
            "salon_id",
            "status",
            "invited_by",
        ]
