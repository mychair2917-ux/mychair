from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator
from app.utils.timezone import now_utc, make_aware


class AppointmentServiceCreate(BaseModel):
    service_id: Optional[str] = None
    salon_service_id: Optional[str] = None
    staff_id: str
    price: float = Field(..., ge=0)

    @field_validator("service_id", "salon_service_id")
    @classmethod
    def normalize_optional_ids(cls, v: Optional[str]) -> Optional[str]:
        cleaned = (v or "").strip()
        return cleaned or None

    @field_validator("staff_id")
    @classmethod
    def normalize_staff_id(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("staff_id is required")
        return cleaned

    @field_validator("price")
    @classmethod
    def validate_price(cls, v: float) -> float:
        if v < 0:
            raise ValueError("price must be greater than or equal to 0")
        return v

    @model_validator(mode="after")
    def validate_service_identity(self) -> "AppointmentServiceCreate":
        if not self.service_id and not self.salon_service_id:
            raise ValueError("Either service_id or salon_service_id is required")
        return self


class AppointmentProductCreate(BaseModel):
    product_id: Optional[str] = None
    salon_product_id: Optional[str] = None
    staff_id: str
    price: float = Field(..., ge=0)

    @field_validator("product_id", "salon_product_id")
    @classmethod
    def normalize_optional_ids(cls, v: Optional[str]) -> Optional[str]:
        cleaned = (v or "").strip()
        return cleaned or None

    @field_validator("staff_id")
    @classmethod
    def normalize_staff_id(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("staff_id is required")
        return cleaned

    @model_validator(mode="after")
    def validate_product_identity(self) -> "AppointmentProductCreate":
        if not self.product_id and not self.salon_product_id:
            raise ValueError("Either product_id or salon_product_id is required")
        return self


class CustomerQuickCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    phone: str = Field(..., min_length=5, max_length=20)
    email: Optional[str] = Field(default=None, max_length=120)


class FrontDeskAppointmentCreate(BaseModel):
    salon_id: str
    customer_id: str
    start_datetime: datetime
    services: List[AppointmentServiceCreate] = Field(default_factory=list)
    products: List[AppointmentProductCreate] = Field(default_factory=list)
    payment_type: str = Field(..., description="Payment method: CASH, UPI, or CARD")
    payment_status: str = Field(default="PAID", description="PAID, PENDING, or PARTIALLY_PAID")
    paid_amount: Optional[float] = Field(default=None, ge=0, description="Required for PARTIALLY_PAID")
    total_amount: float = Field(..., ge=0)
    booking_source: str = Field(default="WALK_IN")
    notes: Optional[str] = None

    @field_validator("payment_type")
    @classmethod
    def validate_payment_type(cls, v: str) -> str:
        normalized = v.upper()
        if normalized not in {"CASH", "UPI", "CARD"}:
            raise ValueError("Payment type must be CASH, UPI, or CARD")
        return normalized

    @field_validator("payment_status")
    @classmethod
    def validate_payment_status(cls, v: str) -> str:
        normalized = v.upper()
        if normalized not in {"PAID", "PENDING", "PARTIALLY_PAID"}:
            raise ValueError("Payment status must be PAID, PENDING, or PARTIALLY_PAID")
        return normalized

    @model_validator(mode="after")
    def validate_line_items(self) -> "FrontDeskAppointmentCreate":
        if not self.services and not self.products:
            raise ValueError("At least one service or product is required")
        if self.payment_status == "PARTIALLY_PAID":
            if self.paid_amount is None:
                raise ValueError("paid_amount is required when payment_status is PARTIALLY_PAID")
            if self.paid_amount >= self.total_amount:
                raise ValueError("paid_amount must be less than total_amount for PARTIALLY_PAID status")
        return self


class AppointmentServiceResponse(BaseModel):
    service_id: str
    name: str
    price: float
    duration_minutes: int
    tax_rate: float
    staff_id: Optional[str] = None
    staff_name: Optional[str] = None


class AppointmentProductResponse(BaseModel):
    product_id: str
    name: str
    price: float
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
    products: List[AppointmentProductResponse] = Field(default_factory=list)
    payment_type: Optional[str] = None
    payment_status: str = "PENDING"
    paid_amount: float = 0.0
