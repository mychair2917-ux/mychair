from datetime import datetime
from beanie import Document
from pydantic import Field
from app.utils.timezone import now_utc


class InvitationToken(Document):
    """Secure invitation token for salon owner onboarding."""
    salon_id: str = Field(..., index=True)
    owner_id: str = Field(..., index=True)
    token: str = Field(..., index=True)
    expires_at: datetime = Field(...)
    is_used: bool = Field(default=False)
    created_at: datetime = Field(default_factory=now_utc)

    class Settings:
        name = "invitation_tokens"
        indexes = [
            "token",
            "salon_id",
            "owner_id",
        ]
