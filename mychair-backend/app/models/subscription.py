from datetime import datetime
from typing import List, Optional

from beanie import Document
from pydantic import BaseModel, Field

from app.utils.timezone import now_utc


class BillingHistoryEntry(BaseModel):
    date: datetime
    action: str
    plan_name: str
    amount: float = 0.0
    notes: str = ""


class Subscription(Document):
    """
    SaaS subscription record linked to a salon branch and tenant.
    """

    tenant_id: str = Field(..., index=True)
    salon_id: Optional[str] = Field(default=None, index=True)
    plan_name: str = Field(...)
    status: str = Field(default="ACTIVE", index=True)  # ACTIVE, EXPIRED, SUSPENDED

    amount: float = Field(default=0.0, ge=0.0)
    currency: str = Field(default="USD")

    start_date: datetime = Field(..., default_factory=now_utc)
    end_date: datetime = Field(...)
    total_days: Optional[int] = Field(default=None, ge=1)

    billing_history: List[BillingHistoryEntry] = Field(default_factory=list)

    created_at: datetime = Field(default_factory=now_utc)
    updated_at: datetime = Field(default_factory=now_utc)
    created_by: Optional[str] = Field(default=None)
    updated_by: Optional[str] = Field(default=None)

    class Settings:
        name = "subscriptions"
        indexes = [
            "tenant_id",
            "salon_id",
            "status",
            [("tenant_id", 1), ("status", 1)],
        ]
