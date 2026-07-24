from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import Field
from app.models.base import BaseTenantDocument

class Notification(BaseTenantDocument):
    """
    Represents in-app notifications and outbound communication queue entries.
    Existing outbound fields are kept for compatibility with older background jobs.
    """
    recipient_type: str = Field(default="USER")  # CUSTOMER, STAFF, USER, ROLE
    recipient_id: str = Field(..., index=True)
    
    channel: str = Field(default="IN_APP")  # IN_APP, EMAIL, SMS, WHATSAPP, PUSH
    recipient_address: Optional[str] = Field(default=None)
    
    subject: Optional[str] = Field(default=None)
    body: str = Field(...)
    title: str = Field(default="Notification")
    notification_type: str = Field(default="GENERAL", index=True)
    category: str = Field(default="GENERAL", index=True)
    priority: str = Field(default="NORMAL", index=True)  # LOW, NORMAL, HIGH, CRITICAL
    source_event: Optional[str] = Field(default=None, index=True)
    salon_id: Optional[str] = Field(default=None, index=True)
    role_targets: List[str] = Field(default_factory=list)
    
    status: str = Field(default="PENDING", index=True)  # PENDING, SENT, FAILED, RETRYING
    read_at: Optional[datetime] = Field(default=None, index=True)
    is_read: bool = Field(default=False, index=True)
    error_message: Optional[str] = Field(default=None)
    
    scheduled_for: Optional[datetime] = Field(default=None, index=True)
    sent_at: Optional[datetime] = Field(default=None)
    
    retry_count: int = Field(default=0)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Settings:
        name = "notifications"
        indexes = [
            "tenant_id",
            "salon_id",
            "recipient_id",
            "notification_type",
            "category",
            "priority",
            "status",
            "is_read",
            "read_at",
            "scheduled_for",
            "is_deleted",
        ]
