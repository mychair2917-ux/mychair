from typing import Optional
from pydantic import Field
from app.models.base import BaseTenantDocument

class Service(BaseTenantDocument):
    """
    Represents a Salon service offering (e.g., Haircut, Balayage, Facial).
    Stores duration and price configurations which are snapshotted during appointment bookings.
    """
    name: str = Field(..., max_length=100)
    category: str = Field(..., max_length=50)  # e.g., 'Hair', 'Nails', 'Skincare'
    description: Optional[str] = Field(default=None)
    
    price: float = Field(..., gt=0.0)  # Base price of the service
    duration_minutes: int = Field(..., gt=0)  # Expected service execution time
    tax_rate: float = Field(default=18.0)  # Default percentage tax rate (e.g. 18%)
    
    is_active: bool = Field(default=True)

    class Settings:
        name = "services"
        indexes = [
            "tenant_id",
            "category",
            "is_deleted",
        ]
