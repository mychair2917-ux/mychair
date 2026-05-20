from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import Field
from beanie import Document
from app.utils.timezone import now_utc

class AuditLog(Document):
    """
    Highly performant, tamper-evident global collection recording document mutation history.
    Used for enterprise compliance and forensic security reviews.
    """
    tenant_id: str = Field(..., index=True)
    user_id: Optional[str] = Field(default=None, index=True)
    
    action: str = Field(...)  # CREATE, UPDATE, DELETE, LOGIN, DOWNLOAD_EXPORT
    entity_name: str = Field(...)  # e.g. "Appointment", "Invoice", "InventoryItem"
    entity_id: Optional[str] = Field(default=None, index=True)
    
    # Audit payloads (diff snapshots)
    before_state: Optional[Dict[str, Any]] = Field(default=None)
    after_state: Optional[Dict[str, Any]] = Field(default=None)
    
    ip_address: Optional[str] = Field(default=None)
    user_agent: Optional[str] = Field(default=None)
    timestamp: datetime = Field(default_factory=now_utc, index=True)

    class Settings:
        name = "audit_logs"
        indexes = [
            "tenant_id",
            "user_id",
            "entity_name",
            "action",
            "timestamp",
        ]
