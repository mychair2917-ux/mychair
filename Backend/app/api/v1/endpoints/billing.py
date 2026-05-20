from fastapi import APIRouter, Depends, status
from app.api.dependencies.auth import PermissionChecker
from app.models.user import User
from app.models.billing import Invoice, Payment
from app.schemas.billing import InvoiceCreate, PaymentCreate, RefundCreate
from app.services.billing import BillingService

router = APIRouter()
billing_service = BillingService()

@router.post("/invoices", response_model=Invoice, status_code=status.HTTP_201_CREATED)
async def create_draft_invoice(
    payload: InvoiceCreate,
    current_user: User = Depends(PermissionChecker("billing.create"))
) -> Invoice:
    """Creates a fresh billing Invoice in DRAFT status, allowing subsequent modifications."""
    return await billing_service.create_draft_invoice(
        salon_id=payload.salon_id,
        customer_id=payload.customer_id,
        appointment_id=payload.appointment_id,
        items_payload=[item.model_dump() for item in payload.items]
    )


@router.post("/invoices/{id}/finalize", response_model=Invoice)
async def finalize_invoice(
    id: str,
    current_user: User = Depends(PermissionChecker("billing.create"))
) -> Invoice:
    """Finalizes invoice details, making prices, line items, and totals immutable."""
    return await billing_service.finalize_invoice(invoice_id=id)


@router.post("/invoices/{id}/payments", response_model=Payment, status_code=status.HTTP_201_CREATED)
async def record_invoice_payment(
    id: str,
    payload: PaymentCreate,
    current_user: User = Depends(PermissionChecker("billing.create"))
) -> Payment:
    """
    Applies split payments (Cash, Card, UPI) to a finalized Invoice.
    Automatically closes invoice to PAID state on full settlement.
    """
    return await billing_service.record_payment(
        invoice_id=id,
        amount=payload.amount,
        payment_method=payload.payment_method,
        transaction_reference=payload.transaction_reference
    )


@router.post("/payments/{id}/refund", response_model=Payment)
async def process_refund(
    id: str,
    payload: RefundCreate,
    current_user: User = Depends(PermissionChecker("billing.refund"))
) -> Payment:
    """Processes full or partial transaction refunds, balancing outstanding invoice aggregates."""
    return await billing_service.record_refund(
        payment_id=id,
        amount=payload.amount,
        reason=payload.reason
    )
