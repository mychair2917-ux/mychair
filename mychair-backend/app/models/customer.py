from datetime import datetime
from typing import Optional, Dict, Any
from pydantic import Field, EmailStr
from app.models.base import BaseTenantDocument

class Customer(BaseTenantDocument):
    """
    Represents a Salon customer (Client).
    Maintains basic contact information, loyalty balance, and detailed CRM notes.
    """
    first_name: str = Field(..., max_length=50)
    last_name: str = Field(..., max_length=50)
    email: Optional[EmailStr] = Field(default=None, index=True)
    phone: str = Field(..., index=True)  # Primary unique contact identifier per tenant

    # Extended profile
    gender: Optional[str] = Field(default=None)   # MALE / FEMALE / OTHER
    dob: Optional[datetime] = Field(default=None)
    address: Optional[str] = Field(default=None)

    # CRM details
    loyalty_points: int = Field(default=0)
    allergies: Optional[str] = Field(default=None)
    preferences: Optional[str] = Field(default=None)
    notes: Optional[str] = Field(default=None)

    # Analytics / reward aggregates
    reward_points: int = Field(default=0)
    total_visits: int = Field(default=0)
    total_spent: float = Field(default=0.0)
    last_visit_at: Optional[datetime] = Field(default=None)

    metadata: Dict[str, Any] = Field(default_factory=dict)

    class Settings:
        name = "customers"
        indexes = [
            "tenant_id",
            "phone",
            "email",
            "is_deleted",
        ]

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
