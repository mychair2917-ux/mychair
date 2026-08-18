from datetime import datetime
from typing import Any, Dict, Optional
from pydantic import Field
from app.models.base import BaseTenantDocument
from app.utils.timezone import now_utc

class SalonWhatsAppAccount(BaseTenantDocument):
    """
    Stores multi-tenant WhatsApp Business Account (WABA) credentials and settings per Salon.
    Each Salon connects its own WhatsApp Business number through Meta's Embedded Signup flow.
    """
    salon_id: str = Field(..., index=True)
    waba_id: Optional[str] = Field(default=None, index=True)
    phone_number_id: Optional[str] = Field(default=None, index=True)
    business_phone_number: Optional[str] = Field(default=None, index=True)
    display_name: Optional[str] = Field(default=None)
    
    # Status tracking: "CONNECTED", "DISCONNECTED", "ERROR", "PENDING"
    status: str = Field(default="DISCONNECTED", index=True)
    
    # Connection state: "ACTIVE", "MIGRATION_REQUIRED", "COEXISTENCE_REQUIRED", "VERIFICATION_REQUIRED"
    connection_status: str = Field(default="ACTIVE", index=True)
    
    # Secure storage for authorization token and Meta onboarding metadata (never exposed to frontend)
    authorization_data: Dict[str, Any] = Field(default_factory=dict)
    
    token_expires_at: Optional[datetime] = Field(default=None)
    connected_at: Optional[datetime] = Field(default=None)
    disconnected_at: Optional[datetime] = Field(default=None)
    
    # Feature toggles per salon
    features: Dict[str, bool] = Field(
        default_factory=lambda: {
            "billing_enabled": True,
            "appointment_confirmations_enabled": True,
            "appointment_reminders_enabled": True,
            "birthday_messages_enabled": True,
            "marketing_enabled": True,
        }
    )
    
    # Meta-approved template mappings for this salon
    templates: Dict[str, str] = Field(
        default_factory=lambda: {
            "bill_receipt": "hello_world",
            "appointment_confirmation": "hello_world",
            "appointment_reminder": "hello_world",
            "appointment_cancellation": "hello_world",
            "birthday_wish": "hello_world",
            "marketing_offer": "hello_world",
        }
    )

    class Settings:
        name = "salon_whatsapp_accounts"
        indexes = [
            "tenant_id",
            "salon_id",
            "waba_id",
            "phone_number_id",
            "status",
            "is_deleted",
        ]

    def is_active(self) -> bool:
        return self.status == "CONNECTED" and bool(self.phone_number_id)
