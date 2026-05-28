from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator
from app.utils.timezone import now_utc, make_aware


class AppointmentServiceCreate(BaseModel):
    service_id: str
    staff_id: str
    price: float = Field(..., ge=0)


class CustomerQuickCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=5, max_length=20)
    email: Optional[str] = Field(default=None, max_length=120)


class FrontDeskAppointmentCreate(BaseModel):
    salon_id: str
    customer_id: str
    start_datetime: datetime
    services: List[AppointmentServiceCreate] = Field(..., min_items=1)
    payment_type: str = Field(..., description="Cash or UPI")
    total_amount: float = Field(..., ge=0)
    booking_source: str = Field(default="WALK_IN")
    notes: Optional[str] = None

    @field_validator("payment_type")
    @classmethod
    def validate_payment_type(cls, v: str) -> str:
        normalized = v.upper()
        if normalized not in {"CASH", "UPI"}:
            raise ValueError("Payment type must be Cash or UPI")
        return normalized


class AppointmentServiceResponse(BaseModel):
    service_id: str
    name: str
    price: float
    duration_minutes: int
    tax_rate: float
    staff_id: Optional[str] = None
    staff_name: Optional[str] = None

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
    services: List[AppointmentServiceResponse] = Field(default_factory=list)
    payment_type: Optional[str] = None
    paid_amount: float = 0.0
