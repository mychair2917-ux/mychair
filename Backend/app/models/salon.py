from typing import Optional, Dict, Any
from pydantic import Field
from app.models.base import BaseTenantDocument

class Salon(BaseTenantDocument):
    """
    Represents a physical branch/location of a Salon.
    Each Salon belongs to a Tenant and can have its own staff, schedules, and inventory.
    """
    name: str = Field(..., max_length=100)
    phone: Optional[str] = Field(default=None)
    email: Optional[str] = Field(default=None)
    
    # Address details (embedded as lightweight object)
    address: Dict[str, Any] = Field(default_factory=dict)
    
    # Timezone handling - crucial for localized booking
    timezone: str = Field(default="UTC")  # e.g., 'America/New_York', 'Asia/Kolkata'
    
    is_active: bool = Field(default=True)

    class Settings:
        name = "salons"
        indexes = [
            "tenant_id",
            "is_deleted",
        ]
