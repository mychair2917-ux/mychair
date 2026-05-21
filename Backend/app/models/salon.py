from typing import Optional, Dict, Any
from pydantic import Field
from app.models.base import BaseTenantDocument

class Salon(BaseTenantDocument):
    """
    Represents a physical branch/location of a Salon.
    Each Salon belongs to a Tenant and can have its own staff, schedules, and inventory.
    """
    name: str = Field(..., max_length=100)
    phone: str = Field(default="")
    email: Optional[str] = Field(default=None)
    address: Dict[str, Any] = Field(default_factory=dict)
    opening_hours: Dict[str, Any] = Field(default_factory=dict)
    timezone: str = Field(default="UTC")
    is_active: bool = Field(default=True)

    class Settings:
        name = "salons"
        indexes = [
            [("tenant_id", 1), ("name", 1)],
            "is_deleted",
        ]
