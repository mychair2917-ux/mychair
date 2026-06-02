from fastapi import APIRouter, Depends, Query, status
from typing import Any, Dict, List, Optional
from app.api.dependencies.auth import PermissionChecker
from app.core import tenant_context
from app.models.user import User
from app.models.billing import Invoice, Payment
from app.schemas.billing import InvoiceCreate, PaymentCreate, RefundCreate
from app.services.billing import BillingService
from app.utils.api_response import success_response

router = APIRouter()
billing_service = BillingService()


def _invoice_to_dict(invoice: Invoice) -> Dict[str, Any]:
    """Serializes an Invoice document to a dict for API response."""
    services_summary = ", ".join(
        item.name for item in invoice.items if item.item_type == "SERVICE"
    )
    products_summary = ", ".join(
        item.name for item in invoice.items if item.item_type == "PRODUCT"
    )
    staff_names = list({
        item.staff_name for item in invoice.items if item.staff_name
    })
    return {
        "id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "appointment_id": invoice.appointment_id,
        "salon_id": invoice.salon_id,
        "salon_name": invoice.salon_name,
        "salon_phone": invoice.salon_phone,
        "salon_address": invoice.salon_address,
        "customer_id": invoice.customer_id,
        "customer_name": invoice.customer_name,
        "customer_phone": invoice.customer_phone,
        "payment_method": invoice.payment_method,
        "payment_status": invoice.payment_status,
        "status": invoice.status,
        "subtotal": invoice.subtotal,
        "tax_amount": invoice.tax_amount,
        "discount_amount": invoice.discount_amount,
        "total_amount": invoice.total_amount,
        "paid_amount": invoice.paid_amount,
        "remaining_amount": invoice.remaining_amount,
        "services_summary": services_summary,
        "products_summary": products_summary,
        "items_summary": ", ".join(filter(None, [services_summary, products_summary])),
        "staff_summary": ", ".join(staff_names),
        "items": [
            {
                "item_type": item.item_type,
                "item_id": item.item_id,
                "name": item.name,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "tax_rate": item.tax_rate,
                "discount": item.discount,
                "staff_id": item.staff_id,
                "staff_name": item.staff_name,
            }
            for item in invoice.items
        ],
        "created_at": invoice.created_at.isoformat() if invoice.created_at else None,
        "finalized_at": invoice.finalized_at.isoformat() if invoice.finalized_at else None,
    }


@router.get("/bills")
async def list_bills(
    salon_id: str = Query(..., description="Salon branch ID"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    payment_status: Optional[str] = Query(default=None, description="PAID, PENDING, PARTIALLY_PAID"),
    search: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("billing.view")),
):
    """Returns paginated bills (invoices) for a salon, latest first."""
    query: Dict[str, Any] = {
        "salon_id": salon_id,
        "is_deleted": False,
    }
    effective_tenant = tenant_context.get_tenant_id()
    if effective_tenant:
        query["tenant_id"] = effective_tenant

    if payment_status:
        query["payment_status"] = payment_status.upper()

    invoices_query = Invoice.find(query).sort("-created_at")
    total = await Invoice.find(query).count()

    if search and search.strip():
        term = search.strip().lower()

    skip = (page - 1) * limit
    raw_invoices = await invoices_query.skip(skip).limit(limit).to_list()

    items = []
    for inv in raw_invoices:
        item_dict = _invoice_to_dict(inv)
        if search and search.strip():
            term = search.strip().lower()
            if (
                term not in (item_dict.get("customer_name") or "").lower()
                and term not in (item_dict.get("invoice_number") or "").lower()
                and term not in (item_dict.get("customer_phone") or "")
            ):
                total -= 1
                continue
        items.append(item_dict)

    pages = max(1, (total + limit - 1) // limit) if total > 0 else 1
    return success_response(
        "Bills retrieved successfully",
        data={
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
    )

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
