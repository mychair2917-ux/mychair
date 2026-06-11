from datetime import datetime
from typing import Optional

from beanie import Document
from pydantic import Field

from app.utils.timezone import now_utc


class SystemSettings(Document):
    """Platform-wide configuration controlled by Super Admin."""

    key: str = Field(default="global", index=True)
    default_subscription_days: int = Field(default=30, ge=1)
    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    updated_by: Optional[str] = Field(default=None)

    class Settings:
        name = "system_settings"
        indexes = ["key"]
