from typing import List, Optional
from pydantic import BaseModel, Field, model_validator

class InvoiceItemPayload(BaseModel):
    item_type: str = Field(..., description="SERVICE or PRODUCT")
    item_id: str
    name: str
    quantity: int = Field(default=1, ge=1)
    unit_price: float = Field(..., ge=0.0)
    tax_rate: float = Field(default=0.0, ge=0.0)
    discount: float = Field(default=0.0, ge=0.0)


class InvoiceCreate(BaseModel):
    salon_id: str
    customer_id: str
    appointment_id: Optional[str] = None
    items: List[InvoiceItemPayload] = Field(..., min_items=1)
    send_whatsapp: bool = Field(default=False, description="Send outbound WhatsApp message upon billing completion")
    send_bill_pdf: bool = Field(default=False, description="Attach generated invoice PDF to outbound WhatsApp message")

    @model_validator(mode="after")
    def validate_whatsapp_options(self) -> "InvoiceCreate":
        if not self.send_whatsapp:
            self.send_bill_pdf = False
        return self


class PaymentCreate(BaseModel):
    amount: float = Field(..., gt=0.0)
    payment_method: str = Field(..., description="CASH, CARD, UPI, LOYALTY")
    transaction_reference: Optional[str] = None


class RefundCreate(BaseModel):
    amount: float = Field(..., gt=0.0)
    reason: Optional[str] = None
