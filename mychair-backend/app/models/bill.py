from datetime import datetime
from typing import List, Optional
from pydantic import Field, BaseModel
from app.models.base import BaseTenantDocument
from app.utils.timezone import now_utc


class BillItem(BaseModel):
    """A single line item inside a customer bill (service or product)."""
    item_type: str              # "SERVICE" or "PRODUCT"
    item_id: str
    name: str
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(..., ge=0.0)
    tax_rate: float = Field(default=0.0, ge=0.0)
    tax_amount: float = Field(default=0.0, ge=0.0)
    staff_id: Optional[str] = Field(default=None)
    staff_name: Optional[str] = Field(default=None)
    line_total: float = Field(default=0.0, ge=0.0)  # (unit_price * quantity) + tax_amount


class Bill(BaseTenantDocument):
    """
    Customer-facing bill auto-generated when an appointment is created.
    Captures the full financial and salon details of the transaction at the point of sale.
    Linked to both the Salon (where the service was rendered) and the Customer (who paid).
    """

    # === Relationships ===
    salon_id: str = Field(..., index=True)
    appointment_id: Optional[str] = Field(default=None, index=True)

    # === Salon Details (snapshotted at time of bill creation) ===
    salon_name: Optional[str] = Field(default=None)
    salon_phone: Optional[str] = Field(default=None)
    salon_address: Optional[str] = Field(default=None)

    # === Customer Details (snapshotted at time of bill creation) ===
    customer_id: str = Field(..., index=True)
    customer_name: Optional[str] = Field(default=None)
    customer_phone: Optional[str] = Field(default=None)

    # === Bill Identity ===
    bill_number: str = Field(..., index=True)     # e.g. "BILL-XYZ4-0001"
    category: str = Field(default="APPOINTMENT")  # APPOINTMENT, WALK_IN, etc.

    # === Line Items ===
    items: List[BillItem] = Field(default_factory=list)

    # === Financial Summary ===
    subtotal: float = Field(default=0.0, ge=0.0)
    tax_amount: float = Field(default=0.0, ge=0.0)
    discount_amount: float = Field(default=0.0, ge=0.0)
    total_amount: float = Field(default=0.0, ge=0.0)
    paid_amount: float = Field(default=0.0, ge=0.0)
    remaining_amount: float = Field(default=0.0, ge=0.0)

    currency: str = Field(default="USD")

    # === Payment Tracking ===
    payment_status: str = Field(default="PENDING", index=True)  # PENDING, PAID, PARTIALLY_PAID
    payment_method: Optional[str] = Field(default=None)         # CASH, CARD, UPI

    # === Timestamps ===
    bill_date: datetime = Field(default_factory=now_utc)

    class Settings:
        name = "bills"
        indexes = [
            "tenant_id",
            "salon_id",
            "customer_id",
            "appointment_id",
            "bill_number",
            "payment_status",
            "is_deleted",
        ]
