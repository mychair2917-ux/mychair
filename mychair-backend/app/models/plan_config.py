from datetime import datetime
from typing import List, Optional

from beanie import Document
from pydantic import Field

from app.utils.timezone import now_utc


class PlanConfig(Document):
    """
    Subscription Plan Feature Configuration Document.
    Stores configurable feature matrices for Free Trial, Basic, Pro, Enterprise.
    """

    plan_key: str = Field(..., index=True, unique=True)  # FREE_TRIAL, BASIC, PROFESSIONAL, ENTERPRISE
    display_name: str = Field(...)  # Free Trial, Basic, Pro, Enterprise
    status: str = Field(default="ACTIVE")  # ACTIVE, INACTIVE
    price: float = Field(default=0.0, ge=0.0)
    currency: str = Field(default="USD")

    features: List[str] = Field(default_factory=list)  # List of stable feature keys e.g. ["DASHBOARD", ...]

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = Field(default=None)
    updated_by: Optional[str] = Field(default=None)

    class Settings:
        name = "plan_configs"
        indexes = [
            "plan_key",
            "status",
        ]
