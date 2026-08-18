from datetime import datetime
from typing import Optional
from pydantic import Field
from app.models.base import BaseTenantDocument
from app.utils.timezone import now_utc


class CustomerMembership(BaseTenantDocument):
    """
    Maintains historical and current membership enrollment records for Salon clients.
    Supports tracking start/end dates, membership types, status, and auditing.
    """
    customer_id: str = Field(..., index=True)
    membership_type: str = Field(default="Standard Membership")
    membership_start_date: datetime
    membership_end_date: datetime
    duration_number: Optional[int] = Field(default=None)
    duration_unit: Optional[str] = Field(default=None)
    status: str = Field(default="ACTIVE", index=True)  # ACTIVE, EXPIRED, CANCELLED
    created_by_name: Optional[str] = Field(default=None)

    class Settings:
        name = "customer_memberships"
        indexes = [
            "tenant_id",
            "customer_id",
            "status",
            "membership_end_date",
            "is_deleted",
        ]
