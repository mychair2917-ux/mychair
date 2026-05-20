from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import Field, BaseModel
from app.models.base import BaseTenantDocument
from app.utils.timezone import now_utc

class ServiceSnapshot(BaseModel):
    """Snapshots service parameters to freeze them against future edits."""
    service_id: str
    name: str
    price: float
    duration_minutes: int
    tax_rate: float

class StatusHistory(BaseModel):
    """Tracks state progressions of an appointment."""
    status: str  # BOOKED, CONFIRMED, CHECKED_IN, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW
    changed_at: datetime = Field(default_factory=now_utc)
    changed_by: Optional[str] = None
    reason: Optional[str] = None

class Appointment(BaseTenantDocument):
    """
    Core Appointment Model representing a customer booking.
    Contains time frames, snapshots of booked services, and state tracking.
    Enforces strict UTC datetime rules.
    """
    salon_id: str = Field(..., index=True)
    customer_id: str = Field(..., index=True)
    staff_id: str = Field(..., index=True)
    
    # Scheduling - Must be UTC-aware datetime objects
    start_datetime: datetime = Field(..., index=True)
    end_datetime: datetime = Field(..., index=True)
    
    # Snapshotted services list
    services: List[ServiceSnapshot] = Field(default_factory=list)
    total_price: float = Field(default=0.0)
    
    # State management
    status: str = Field(default="BOOKED", index=True)  # Current overall status
    status_history: List[StatusHistory] = Field(default_factory=list)
    
    # Additional Context
    booking_source: str = Field(default="RECEPTIONIST")  # RECEPTIONIST, CLIENT_APP, WEB_WIDGET
    notes: Optional[str] = Field(default=None)
    
    # Cancellation details (if applicable)
    cancellation_reason: Optional[str] = Field(default=None)
    cancelled_at: Optional[datetime] = Field(default=None)
    cancelled_by: Optional[str] = Field(default=None)

    class Settings:
        name = "appointments"
        # Highly optimized compound indexes for active calendar schedules, conflict prevention, and CRM lookups
        indexes = [
            # 1. Tenant + Staff availability & conflict prevention index
            [
                ("tenant_id", 1),
                ("staff_id", 1),
                ("is_deleted", 1),
                ("status", 1),
                ("start_datetime", 1),
                ("end_datetime", 1),
            ],
            # 2. Tenant + Branch calendar schedules query index
            [
                ("tenant_id", 1),
                ("salon_id", 1),
                ("is_deleted", 1),
                ("start_datetime", 1),
                ("end_datetime", 1),
            ],
            # 3. Customer appointment history index
            [
                ("tenant_id", 1),
                ("customer_id", 1),
                ("is_deleted", 1),
                ("start_datetime", -1),
            ],
        ]

    def add_status(self, status: str, changed_by: Optional[str] = None, reason: Optional[str] = None) -> None:
        """Helper to advance appointment status with audit history."""
        self.status = status
        self.status_history.append(
            StatusHistory(status=status, changed_at=now_utc(), changed_by=changed_by, reason=reason)
        )
        if status == "CANCELLED":
            self.cancelled_at = now_utc()
            self.cancelled_by = changed_by
            self.cancellation_reason = reason
