from datetime import datetime
from pydantic import Field
from beanie import Document
from app.utils.timezone import now_utc

class Subscription(Document):
    """
    Global system subscription record tracking SaaS subscription status, cycle dates,
    renewal terms, and payment receipts.
    """
    tenant_id: str = Field(..., index=True)
    plan_name: str = Field(...)  # FREE, BASIC, PREMIUM, ENTERPRISE
    status: str = Field(default="ACTIVE", index=True)  # ACTIVE, EXPIRED, CANCELLED, PAST_DUE
    
    amount: float = Field(..., ge=0.0)
    currency: str = Field(default="USD")
    
    start_date: datetime = Field(..., default_factory=now_utc)
    end_date: datetime = Field(...)
    
    next_billing_date: datetime = Field(...)
    
    class Settings:
        name = "subscriptions"
        indexes = [
            "tenant_id",
            "status",
        ]
