from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import Field

from app.models.base import BaseTenantDocument


class WhatsAppMessageLog(BaseTenantDocument):
    """Audit log for outbound WhatsApp messages."""

    salon_id: str = Field(..., index=True)
    appointment_id: Optional[str] = Field(default=None, index=True)
    invoice_id: Optional[str] = Field(default=None, index=True)
    bill_id: Optional[str] = Field(default=None, index=True)
    customer_id: str = Field(..., index=True)
    phone_number: str = Field(..., index=True)
    original_customer_phone: Optional[str] = Field(default=None)
    test_override_used: bool = Field(default=False)
    message_type: str = Field(default="INVOICE_REVIEW", index=True)
    message_status: str = Field(default="pending", index=True)
    delivery_status: Optional[str] = Field(default=None, index=True)
    wamid: Optional[str] = Field(default=None, index=True)
    invoice_url: Optional[str] = Field(default=None)
    reward_points: int = Field(default=0)
    message_payload: Optional[Dict[str, Any]] = Field(default=None)
    api_response: Optional[Dict[str, Any]] = Field(default=None)
    error_message: Optional[str] = Field(default=None)
    sent_at: Optional[datetime] = Field(default=None)
    delivered_at: Optional[datetime] = Field(default=None)
    read_at: Optional[datetime] = Field(default=None)
    failed_at: Optional[datetime] = Field(default=None)

    class Settings:
        name = "whatsapp_message_logs"
        indexes = [
            "tenant_id",
            "salon_id",
            "appointment_id",
            "invoice_id",
            "bill_id",
            "customer_id",
            "phone_number",
            "message_status",
            "message_type",
            "is_deleted",
        ]
