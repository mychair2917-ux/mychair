from datetime import datetime
from typing import Any, Dict, Optional, List
from pydantic import BaseModel, Field

class WhatsAppAccountResponse(BaseModel):
    id: Optional[str] = None
    salon_id: str
    status: str
    connection_status: str
    waba_id: Optional[str] = None
    phone_number_id: Optional[str] = None
    business_phone_number: Optional[str] = None
    display_name: Optional[str] = None
    connected_at: Optional[str] = None
    disconnected_at: Optional[str] = None
    features: Dict[str, bool] = Field(default_factory=dict)
    templates: Dict[str, str] = Field(default_factory=dict)

class WhatsAppConfigResponse(BaseModel):
    app_id: Optional[str] = Field(default=None, description="Meta App ID for FB SDK")
    config_id: Optional[str] = Field(default=None, description="Meta Embedded Signup Configuration ID")
    oauth_redirect_uri: Optional[str] = Field(default=None, description="Meta OAuth Redirect URI")
    configured: bool = Field(default=False, description="Whether Meta Embedded Signup is properly configured")

class WhatsAppEmbeddedSignupPayload(BaseModel):
    salon_id: str = Field(..., description="Salon ID")
    code: Optional[str] = Field(default=None, description="Authorization code from Meta Embedded Signup OAuth")
    waba_id: Optional[str] = Field(default=None, description="Captured WABA ID from Meta SDK postMessage event")
    phone_number_id: Optional[str] = Field(default=None, description="Captured Phone Number ID from Meta SDK postMessage event")
    access_token: Optional[str] = Field(default=None, description="Direct token fallback (for dev/test override)")
    direct_access_token: Optional[str] = Field(default=None, description="Access token provided directly by FB.login authResponse")
    redirect_uri: Optional[str] = Field(default=None, description="Optional redirect URI if initiated via top-level OAuth redirect")

class WhatsAppConnectPayload(BaseModel):
    salon_id: str = Field(..., description="Salon ID")
    waba_id: str = Field(..., description="Meta WhatsApp Business Account ID")
    phone_number_id: str = Field(..., description="Meta Phone Number ID")
    business_phone_number: str = Field(..., description="Salon WhatsApp Phone Number")
    display_name: Optional[str] = Field(default=None, description="Display Name on WhatsApp")
    access_token: str = Field(..., description="Meta System User or User Access Token")
    connection_status: Optional[str] = Field(default="ACTIVE")


class WhatsAppSettingsUpdatePayload(BaseModel):
    salon_id: str = Field(..., description="Salon ID")
    features: Optional[Dict[str, bool]] = Field(default=None, description="Feature toggles")
    templates: Optional[Dict[str, str]] = Field(default=None, description="Template mappings")

class WhatsAppTestMessagePayload(BaseModel):
    salon_id: str = Field(..., description="Salon ID")
    recipient_phone: str = Field(..., description="Phone number to send test message to")

class WhatsAppMessageLogResponse(BaseModel):
    id: str
    salon_id: str
    customer_id: Optional[str] = None
    phone_number: str
    message_type: str
    status: str
    delivery_status: Optional[str] = None
    template_name: Optional[str] = None
    wamid: Optional[str] = None
    reference_type: Optional[str] = None
    reference_id: Optional[str] = None
    error_message: Optional[str] = None
    sent_at: Optional[str] = None
    delivered_at: Optional[str] = None
    read_at: Optional[str] = None
    created_at: Optional[str] = None
