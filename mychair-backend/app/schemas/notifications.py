from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


class NotificationOut(BaseModel):
    id: str
    title: str
    body: str
    notification_type: str
    category: str
    priority: str
    source_event: Optional[str] = None
    salon_id: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    created_at: datetime
    metadata: Dict[str, Any] = Field(default_factory=dict)


class PaginatedNotifications(BaseModel):
    items: List[NotificationOut]
    total: int
    page: int
    limit: int
    pages: int
    unread_count: int


class NotificationCreateRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    body: str = Field(..., min_length=1)
    category: str = Field(default="GENERAL")
    notification_type: str = Field(default="GENERAL")
    priority: str = Field(default="NORMAL")
    salon_id: Optional[str] = None
    recipient_ids: List[str] = Field(default_factory=list)
    role_targets: List[str] = Field(default_factory=list)


class PreferenceUpdateRequest(BaseModel):
    email_enabled: Optional[bool] = None
    whatsapp_enabled: Optional[bool] = None
    sound_enabled: Optional[bool] = None
    browser_notification_enabled: Optional[bool] = None
    popup_toast_enabled: Optional[bool] = None
    categories: Optional[Dict[str, Dict[str, bool]]] = None


class TemplateCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    template_type: str
    channel: str = Field(default="EMAIL")
    subject: Optional[str] = None
    body: str = Field(..., min_length=1)
    variables: List[str] = Field(default_factory=list)
    salon_id: Optional[str] = None


class TemplateUpdateRequest(BaseModel):
    name: Optional[str] = None
    template_type: Optional[str] = None
    channel: Optional[str] = None
    subject: Optional[str] = None
    body: Optional[str] = None
    variables: Optional[List[str]] = None
    status: Optional[str] = None


class CampaignCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=140)
    communication_type: str
    audience: str
    selected_customer_ids: List[str] = Field(default_factory=list)
    subject: Optional[str] = None
    body: str = Field(..., min_length=1)
    send_now: bool = Field(default=True)
    scheduled_for: Optional[datetime] = None
    salon_id: Optional[str] = None


class PaginatedResponse(BaseModel):
    items: List[Dict[str, Any]]
    total: int
    page: int
    limit: int
    pages: int
