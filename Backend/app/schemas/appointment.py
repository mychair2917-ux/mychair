from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from app.utils.timezone import now_utc, make_aware

class AppointmentCreate(BaseModel):
    salon_id: str = Field(..., description="Target Salon Branch ID")
    customer_id: str = Field(..., description="Client Customer ID")
    staff_id: str = Field(..., description="Booked Stylist/Staff ID")
    
    start_datetime: datetime = Field(..., description="UTC-aware start time of the booking")
    service_ids: List[str] = Field(..., min_items=1, description="List of booked Service IDs")
    
    notes: Optional[str] = Field(default=None)
    booking_source: Optional[str] = Field(default="RECEPTIONIST")

    @field_validator("start_datetime")
    @classmethod
    def validate_future_date(cls, v: datetime) -> datetime:
        """Enforces that bookings can only be placed for future timeframes."""
        aware_v = make_aware(v)
        if aware_v <= now_utc():
            raise ValueError("Appointments must be booked in the future.")
        return aware_v

class AppointmentStatusUpdate(BaseModel):
    status: str = Field(..., description="BOOKED, CONFIRMED, CHECKED_IN, IN_PROGRESS, COMPLETED, CANCELLED, NO_SHOW")
    reason: Optional[str] = Field(default=None, description="Reason for status change (required for cancellation)")

    @field_validator("status")
    @classmethod
    def validate_status_term(cls, v: str) -> str:
        allowed = {"BOOKED", "CONFIRMED", "CHECKED_IN", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW"}
        upper_v = v.upper()
        if upper_v not in allowed:
            raise ValueError(f"Invalid status '{v}'. Allowed: {allowed}")
        return upper_v
class AppointmentResponse(BaseModel):
    id: str
    salon_id: str
    customer_id: str
    staff_id: str
    start_datetime: datetime
    end_datetime: datetime
    total_price: float
    status: str
    notes: Optional[str]
    booking_source: str
