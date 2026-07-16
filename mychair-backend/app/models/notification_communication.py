from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import Field

from app.models.base import BaseTenantDocument
from app.utils.timezone import now_utc


DEFAULT_NOTIFICATION_CATEGORIES = [
    "APPOINTMENT",
    "LEAVE",
    "INVENTORY",
    "ATTENDANCE",
    "CUSTOMER",
    "SUBSCRIPTION",
    "PAYMENT",
    "STAFF",
    "GENERAL",
]


def default_preference_channels() -> Dict[str, Dict[str, bool]]:
    return {
        category: {"in_app": True, "sound": True, "email": True, "whatsapp": True}
        for category in DEFAULT_NOTIFICATION_CATEGORIES
    }


class NotificationPreference(BaseTenantDocument):
    user_id: str = Field(..., index=True)
    email_enabled: bool = Field(default=True)
    whatsapp_enabled: bool = Field(default=True)
    sound_enabled: bool = Field(default=True)
    browser_notification_enabled: bool = Field(default=True)
    popup_toast_enabled: bool = Field(default=True)
    categories: Dict[str, Dict[str, bool]] = Field(default_factory=default_preference_channels)

    class Settings:
        name = "notification_preferences"
        indexes = [
            "tenant_id",
            "user_id",
            "is_deleted",
            [("tenant_id", 1), ("user_id", 1)],
        ]


class NotificationTemplate(BaseTenantDocument):
    salon_id: Optional[str] = Field(default=None, index=True)
    name: str = Field(..., index=True)
    template_type: str = Field(..., index=True)
    channel: str = Field(default="EMAIL", index=True)
    subject: Optional[str] = Field(default=None)
    body: str = Field(...)
    variables: List[str] = Field(default_factory=list)
    status: str = Field(default="APPROVED", index=True)
    is_system: bool = Field(default=False, index=True)
    cloned_from_template_id: Optional[str] = Field(default=None)

    class Settings:
        name = "notification_templates"
        indexes = [
            "tenant_id",
            "salon_id",
            "template_type",
            "channel",
            "status",
            "is_deleted",
        ]


class CommunicationCampaign(BaseTenantDocument):
    salon_id: Optional[str] = Field(default=None, index=True)
    name: str = Field(..., index=True)
    communication_type: str = Field(..., index=True)  # EMAIL, WHATSAPP, BOTH
    audience: str = Field(..., index=True)
    selected_customer_ids: List[str] = Field(default_factory=list)
    subject: Optional[str] = Field(default=None)
    body: str = Field(...)
    status: str = Field(default="DRAFT", index=True)  # DRAFT, SCHEDULED, SENDING, SENT, PARTIALLY_SENT, FAILED
    scheduled_for: Optional[datetime] = Field(default=None, index=True)
    sent_at: Optional[datetime] = Field(default=None)
    totals: Dict[str, int] = Field(
        default_factory=lambda: {
            "total_recipients": 0,
            "total_jobs": 0,
            "pending": 0,
            "sent": 0,
            "delivered": 0,
            "failed": 0,
        }
    )

    class Settings:
        name = "communication_campaigns"
        indexes = [
            "tenant_id",
            "salon_id",
            "communication_type",
            "audience",
            "status",
            "scheduled_for",
            "is_deleted",
        ]


class CommunicationRecipient(BaseTenantDocument):
    campaign_id: str = Field(..., index=True)
    customer_id: str = Field(..., index=True)
    customer_name: str = Field(default="")
    email: Optional[str] = Field(default=None)
    phone: Optional[str] = Field(default=None)
    status: str = Field(default="PENDING", index=True)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Settings:
        name = "communication_recipients"
        indexes = [
            "tenant_id",
            "campaign_id",
            "customer_id",
            "status",
            "is_deleted",
        ]


class CommunicationLog(BaseTenantDocument):
    campaign_id: Optional[str] = Field(default=None, index=True)
    recipient_id: Optional[str] = Field(default=None, index=True)
    customer_id: Optional[str] = Field(default=None, index=True)
    channel: str = Field(..., index=True)
    recipient_address: str = Field(default="")
    status: str = Field(default="PENDING", index=True)
    provider: str = Field(default="internal")
    provider_message_id: Optional[str] = Field(default=None, index=True)
    error_message: Optional[str] = Field(default=None)
    sent_at: Optional[datetime] = Field(default=None)
    delivered_at: Optional[datetime] = Field(default=None)
    failed_at: Optional[datetime] = Field(default=None)
    payload: Dict[str, Any] = Field(default_factory=dict)

    class Settings:
        name = "communication_logs"
        indexes = [
            "tenant_id",
            "campaign_id",
            "recipient_id",
            "customer_id",
            "channel",
            "status",
            "is_deleted",
        ]


class SubscriptionNotification(BaseTenantDocument):
    salon_id: Optional[str] = Field(default=None, index=True)
    subscription_id: Optional[str] = Field(default=None, index=True)
    event_type: str = Field(..., index=True)
    priority: str = Field(default="HIGH", index=True)
    title: str = Field(...)
    message: str = Field(...)
    status: str = Field(default="OPEN", index=True)
    triggered_at: datetime = Field(default_factory=now_utc, index=True)

    class Settings:
        name = "subscription_notifications"
        indexes = [
            "tenant_id",
            "salon_id",
            "subscription_id",
            "event_type",
            "status",
            "is_deleted",
        ]


class BusinessAlert(BaseTenantDocument):
    salon_id: Optional[str] = Field(default=None, index=True)
    alert_type: str = Field(..., index=True)
    category: str = Field(..., index=True)
    priority: str = Field(default="NORMAL", index=True)
    title: str = Field(...)
    message: str = Field(...)
    source_id: Optional[str] = Field(default=None, index=True)
    status: str = Field(default="OPEN", index=True)
    resolved_at: Optional[datetime] = Field(default=None)
    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Settings:
        name = "business_alerts"
        indexes = [
            "tenant_id",
            "salon_id",
            "alert_type",
            "category",
            "status",
            "priority",
            "is_deleted",
        ]
