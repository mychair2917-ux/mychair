from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import Field, BaseModel
from app.models.base import BaseTenantDocument
from app.utils.timezone import now_utc

class InvoiceItem(BaseModel):
    """Represents a snapshotted line item inside an invoice."""
    item_type: str  # "SERVICE" or "PRODUCT"
    item_id: str
    name: str
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(..., ge=0.0)
    tax_rate: float = Field(default=0.0, ge=0.0)
    discount: float = Field(default=0.0, ge=0.0)

    @property
    def subtotal(self) -> float:
        return (self.unit_price * self.quantity) - self.discount

    @property
    def tax_amount(self) -> float:
        return self.subtotal * (self.tax_rate / 100)

    @property
    def total(self) -> float:
        return self.subtotal + self.tax_amount


class Invoice(BaseTenantDocument):
    """
    Invoice Model representing a transaction statement.
    Becomes strictly immutable once marked as FINALIZED, PAID, or VOIDED.
    """
    salon_id: str = Field(..., index=True)
    customer_id: str = Field(..., index=True)
    appointment_id: Optional[str] = Field(default=None, index=True)
    
    invoice_number: str = Field(..., index=True)  # unique generated tag e.g. "INV-1002"
    status: str = Field(default="DRAFT", index=True)  # DRAFT, FINALIZED, PAID, VOIDED
    
    items: List[InvoiceItem] = Field(default_factory=list)
    
    subtotal: float = Field(default=0.0)
    tax_amount: float = Field(default=0.0)
    discount_amount: float = Field(default=0.0)
    total_amount: float = Field(default=0.0)
    amount_paid: float = Field(default=0.0)
    
    finalized_at: Optional[datetime] = Field(default=None)
    
    class Settings:
        name = "invoices"
        indexes = [
            "tenant_id",
            "invoice_number",
            "status",
            "is_deleted",
        ]

    def finalize(self) -> None:
        """Transitions invoice status to FINALIZED and captures timestamp."""
        self.status = "FINALIZED"
        self.finalized_at = now_utc()


class Payment(BaseTenantDocument):
    """
    Payment Model representing a separate transaction event.
    Kept separate from Invoices to support independent tracking, refunds, and audits.
    """
    invoice_id: str = Field(..., index=True)
    salon_id: str = Field(..., index=True)
    
    amount: float = Field(..., gt=0.0)
    payment_method: str = Field(..., index=True)  # CASH, CARD, UPI, LOYALTY
    status: str = Field(default="SUCCESSFUL", index=True)  # SUCCESSFUL, FAILED, REFUNDED
    
    transaction_reference: Optional[str] = Field(default=None)  # e.g., UPI ID or gateway ID
    
    # Audit tracking for refunds
    refunded_amount: float = Field(default=0.0)
    refund_reason: Optional[str] = Field(default=None)
    payment_date: datetime = Field(default_factory=now_utc)

    class Settings:
        name = "payments"
        indexes = [
            "tenant_id",
            "invoice_id",
            "payment_method",
            "status",
            "is_deleted",
        ]
