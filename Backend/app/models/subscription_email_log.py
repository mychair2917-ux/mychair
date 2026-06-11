from datetime import datetime

from beanie import Document
from pydantic import Field

from app.utils.timezone import now_utc


class SubscriptionEmailLog(Document):
    """Tracks expiry reminder emails to prevent duplicate sends."""

    subscription_id: str = Field(..., index=True)
    tenant_id: str = Field(..., index=True)
    days_before_expiry: int = Field(..., ge=1)
    sent_at: datetime = Field(default_factory=now_utc)

    class Settings:
        name = "subscription_email_logs"
        indexes = [
            [("subscription_id", 1), ("days_before_expiry", 1)],
        ]
