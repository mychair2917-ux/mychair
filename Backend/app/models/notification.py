from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import Field
from app.models.base import BaseTenantDocument
from app.utils.timezone import now_utc

class Notification(BaseTenantDocument):
    """
    Represents communication messages (SMS, Email, WhatsApp, Push) queued or sent.
    Integrates directly with background jobs to record delivery success.
    """
    recipient_type: str = Field(...)  # "CUSTOMER" or "STAFF" or "USER"
    recipient_id: str = Field(..., index=True)
    
    channel: str = Field(...)  # "EMAIL", "SMS", "WHATSAPP", "PUSH"
    recipient_address: str = Field(...)  # Email address or phone number
    
    subject: Optional[str] = Field(default=None)
    body: str = Field(...)
    
    status: str = Field(default="PENDING", index=True)  # PENDING, SENT, FAILED, RETRYING
    error_message: Optional[str] = Field(default=None)
    
    scheduled_for: Optional[datetime] = Field(default=None, index=True)
    sent_at: Optional[datetime] = Field(default=None)
    
    retry_count: int = Field(default=0)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Settings:
        name = "notifications"
        indexes = [
            "tenant_id",
            "recipient_id",
            "status",
            "scheduled_for",
            "is_deleted",
        ]
