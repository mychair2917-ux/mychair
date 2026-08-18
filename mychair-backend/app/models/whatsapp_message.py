from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import Field
from app.models.base import BaseTenantDocument

class WhatsAppMessageLog(BaseTenantDocument):
    """
    Audit log and lifecycle tracker for outbound/inbound WhatsApp Cloud API messages.
    Supports complete tracking of sent, delivered, read, and failed statuses.
    """
    salon_id: str = Field(..., index=True)
    customer_id: Optional[str] = Field(default=None, index=True)
    phone_number: str = Field(..., index=True)
    original_customer_phone: Optional[str] = Field(default=None)
    test_override_used: bool = Field(default=False)
    
    # Message categorization: BILL_RECEIPT, APPOINTMENT_CONFIRMATION, APPOINTMENT_REMINDER, APPOINTMENT_CANCEL, BIRTHDAY_WISH, OFFER_MARKETING, TEST_MESSAGE, INCOMING
    message_type: str = Field(default="BILL_RECEIPT", index=True)
    
    # Status progression: QUEUED, SENDING, SENT, DELIVERED, READ, FAILED, CANCELLED
    status: str = Field(default="QUEUED", index=True)
    delivery_status: Optional[str] = Field(default=None, index=True)
    
    template_name: Optional[str] = Field(default=None)
    template_language: str = Field(default="en_US")
    template_variables: Optional[Dict[str, Any]] = Field(default=None)
    
    # Meta Graph API message ID (wamid)
    wamid: Optional[str] = Field(default=None, index=True)
    meta_message_id: Optional[str] = Field(default=None, index=True)
    
    # Context references
    reference_type: Optional[str] = Field(default=None, index=True)  # BILL, APPOINTMENT, CAMPAIGN, BIRTHDAY, TEST
    reference_id: Optional[str] = Field(default=None, index=True)
    
    # Deduplication key format: salon_id:reference_type:reference_id:message_type
    deduplication_key: Optional[str] = Field(default=None, index=True)
    
    appointment_id: Optional[str] = Field(default=None, index=True)
    invoice_id: Optional[str] = Field(default=None, index=True)
    bill_id: Optional[str] = Field(default=None, index=True)
    invoice_url: Optional[str] = Field(default=None)
    reward_points: int = Field(default=0)
    
    # Audit payloads and error handling
    message_payload: Optional[Dict[str, Any]] = Field(default=None)
    api_response: Optional[Dict[str, Any]] = Field(default=None)
    error_code: Optional[str] = Field(default=None)
    error_message: Optional[str] = Field(default=None)
    
    retry_count: int = Field(default=0)
    max_retries: int = Field(default=3)
    
    sent_at: Optional[datetime] = Field(default=None)
    delivered_at: Optional[datetime] = Field(default=None)
    read_at: Optional[datetime] = Field(default=None)
    failed_at: Optional[datetime] = Field(default=None)

    class Settings:
        name = "whatsapp_messages"
        indexes = [
            "tenant_id",
            "salon_id",
            "appointment_id",
            "invoice_id",
            "bill_id",
            "customer_id",
            "phone_number",
            "status",
            "delivery_status",
            "wamid",
            "meta_message_id",
            "message_type",
            "reference_type",
            "reference_id",
            "deduplication_key",
            "is_deleted",
        ]
