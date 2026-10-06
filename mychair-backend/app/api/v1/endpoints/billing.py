from datetime import datetime, time, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from typing import Any, Dict, List, Optional
from beanie import PydanticObjectId
from app.api.dependencies.auth import PermissionChecker
from app.core import tenant_context
from app.models.user import User
from app.models.billing import Invoice, Payment
from app.models.customer import Customer
from app.models.salon import Salon
from app.models.tenant import Tenant
from app.auth.rbac_config import ROLE_SALON_OWNER
from app.core.exceptions import ResourceNotFoundException
from app.schemas.billing import InvoiceCreate, PaymentCreate, RefundCreate
from app.services.billing import BillingService
from app.services.notifications import notification_service
from app.services.whatsapp import WhatsAppService
from app.utils.api_response import success_response
from app.utils.timezone import KOLKATA_TZ
from app.api.v1.endpoints.bulk_billing import router as bulk_billing_router

router = APIRouter()
router.include_router(bulk_billing_router)
billing_service = BillingService()
whatsapp_service = WhatsAppService()


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
        "notes": getattr(invoice, "notes", None),
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
        "whatsapp_status": "pending",
    }


def _parse_date_yyyy_mm_dd(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        parsed = datetime.strptime(value, "%Y-%m-%d")
        return parsed.replace(tzinfo=timezone.utc)
    except ValueError as exc:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid date format '{value}'. Expected YYYY-MM-DD.",
        ) from exc


@router.get("/bills")
@router.get("/history")
async def list_bills(
    salon_id: str = Query(..., description="Salon branch ID"),
    branch_id: Optional[str] = Query(default=None, description="Optional branch override"),
    appointment_id: Optional[str] = Query(default=None, description="Filter by appointment ID"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    payment_status: Optional[str] = Query(default=None, description="PAID, PENDING, PARTIALLY_PAID"),
    bill_status: Optional[str] = Query(default=None, description="FINALIZED, VOIDED, DRAFT"),
    payment_method: Optional[str] = Query(default=None, description="CASH, UPI, CARD, SPLIT"),
    staff_id: Optional[str] = Query(default=None),
    staff_name: Optional[str] = Query(default=None),
    start_date: Optional[str] = Query(
        default=None, description="YYYY-MM-DD", alias="startDate"
    ),
    end_date: Optional[str] = Query(
        default=None, description="YYYY-MM-DD", alias="endDate"
    ),
    month: Optional[int] = Query(
        default=None, ge=1, le=12, description="Month (1-12) for monthly data display"
    ),
    year: Optional[int] = Query(
        default=None, ge=2000, le=2100, description="Year (e.g. 2026)"
    ),
    search: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("billing.view")),
):
    """Returns paginated bills (invoices) for a salon, latest first, with month-wise filtering."""
    effective_salon_id = branch_id if isinstance(branch_id, str) and branch_id else salon_id
    query: Dict[str, Any] = {
        "salon_id": effective_salon_id,
        "is_deleted": False,
    }
    effective_tenant = tenant_context.get_tenant_id()
    if effective_tenant:
        query["tenant_id"] = effective_tenant

    if isinstance(appointment_id, str) and appointment_id.strip():
        query["appointment_id"] = appointment_id.strip()
    if isinstance(payment_status, str) and payment_status:
        query["payment_status"] = payment_status.upper()
    if isinstance(bill_status, str) and bill_status:
        query["status"] = bill_status.upper()
    if isinstance(payment_method, str) and payment_method:
        query["payment_method"] = payment_method.upper()
    if isinstance(staff_id, str) and staff_id:
        query["items.staff_id"] = staff_id
    if isinstance(staff_name, str) and staff_name.strip():
        query["items.staff_name"] = {"$regex": staff_name.strip(), "$options": "i"}

    # Sanitize month & year
    filter_month = month if isinstance(month, int) else None
    filter_year = year if isinstance(year, int) else None
    start_date_str = start_date if isinstance(start_date, str) else None
    end_date_str = end_date if isinstance(end_date, str) else None
    search_str = search if isinstance(search, str) else None
    page_num = page if isinstance(page, int) and page >= 1 else 1
    limit_num = limit if isinstance(limit, int) and limit >= 1 else 20

    # Month & Year filtering takes precedence when provided
    if filter_month is not None or filter_year is not None:
        if filter_month is not None and not (1 <= filter_month <= 12):
            raise HTTPException(
                status_code=422,
                detail=f"Invalid month '{filter_month}'. Expected month between 1 and 12.",
            )
        if filter_year is not None and not (2000 <= filter_year <= 2100):
            raise HTTPException(
                status_code=422,
                detail=f"Invalid year '{filter_year}'. Expected year between 2000 and 2100.",
            )
        now_local = datetime.now(KOLKATA_TZ)
        resolved_year = filter_year if filter_year is not None else now_local.year
        if filter_month is not None:
            # start_date = first day of selected month at 00:00:00 local time
            start_dt = datetime(resolved_year, filter_month, 1, 0, 0, 0, tzinfo=KOLKATA_TZ)
            # end_date = first day of next month at 00:00:00 local time
            if filter_month == 12:
                end_dt = datetime(resolved_year + 1, 1, 1, 0, 0, 0, tzinfo=KOLKATA_TZ)
            else:
                end_dt = datetime(resolved_year, filter_month + 1, 1, 0, 0, 0, tzinfo=KOLKATA_TZ)
            query["created_at"] = {
                "$gte": start_dt,
                "$lt": end_dt,
            }
        else:
            start_dt = datetime(resolved_year, 1, 1, 0, 0, 0, tzinfo=KOLKATA_TZ)
            end_dt = datetime(resolved_year + 1, 1, 1, 0, 0, 0, tzinfo=KOLKATA_TZ)
            query["created_at"] = {
                "$gte": start_dt,
                "$lt": end_dt,
            }
    else:
        start_dt = _parse_date_yyyy_mm_dd(start_date_str)
        end_dt = _parse_date_yyyy_mm_dd(end_date_str)
        if start_dt or end_dt:
            query["created_at"] = {}
            if start_dt:
                query["created_at"]["$gte"] = datetime.combine(
                    start_dt.date(), time.min, tzinfo=timezone.utc
                )
            if end_dt:
                query["created_at"]["$lte"] = datetime.combine(
                    end_dt.date(), time.max, tzinfo=timezone.utc
                )
            if (
                query["created_at"].get("$gte")
                and query["created_at"].get("$lte")
                and query["created_at"]["$gte"] > query["created_at"]["$lte"]
            ):
                query["created_at"]["$gte"], query["created_at"]["$lte"] = (
                    query["created_at"]["$lte"],
                    query["created_at"]["$gte"],
                )

    if search_str and search_str.strip():
        term = search_str.strip()
        query["$or"] = [
            {"customer_name": {"$regex": term, "$options": "i"}},
            {"invoice_number": {"$regex": term, "$options": "i"}},
            {"customer_phone": {"$regex": term, "$options": "i"}},
        ]

    # Latest billing entry MUST appear first, deterministic tie-breaker with _id DESC
    invoices_query = Invoice.find(query).sort("-created_at", "-_id")
    total = await Invoice.find(query).count()

    # Calculate month-wide / query-wide aggregate statistics
    total_amount = 0.0
    total_paid = 0.0
    total_pending = 0.0
    total_tax = 0.0
    total_discount = 0.0

    if total > 0:
        try:
            pipeline = [
                {"$match": query},
                {
                    "$group": {
                        "_id": None,
                        "total_amount": {"$sum": "$total_amount"},
                        "total_paid": {"$sum": "$paid_amount"},
                        "total_pending": {"$sum": "$remaining_amount"},
                        "total_tax": {"$sum": "$tax_amount"},
                        "total_discount": {"$sum": "$discount_amount"},
                    }
                },
            ]
            agg_result = await Invoice.aggregate(pipeline).to_list()
            if agg_result:
                agg_data = agg_result[0]
                total_amount = round(float(agg_data.get("total_amount") or 0.0), 2)
                total_paid = round(float(agg_data.get("total_paid") or 0.0), 2)
                total_pending = round(float(agg_data.get("total_pending") or 0.0), 2)
                total_tax = round(float(agg_data.get("total_tax") or 0.0), 2)
                total_discount = round(float(agg_data.get("total_discount") or 0.0), 2)
        except Exception:
            pass

    skip = (page_num - 1) * limit_num
    raw_invoices = await invoices_query.skip(skip).limit(limit_num).to_list()

    inv_ids = [str(inv.id) for inv in raw_invoices if inv.id]
    whatsapp_statuses = await whatsapp_service.latest_statuses_for_invoices(inv_ids)

    items = []
    for inv in raw_invoices:
        item = _invoice_to_dict(inv)
        item["whatsapp_status"] = whatsapp_statuses.get(str(inv.id), "pending")
        items.append(item)

    pages = max(1, (total + limit_num - 1) // limit_num) if total > 0 else 1
    return success_response(
        "Bills retrieved successfully",
        data={
            "items": items,
            "total": total,
            "page": page_num,
            "limit": limit_num,
            "pages": pages,
            "totals": {
                "total_bills": total,
                "total_amount": total_amount,
                "total_paid": total_paid,
                "total_pending": total_pending,
                "total_tax": total_tax,
                "total_discount": total_discount,
            },
            "month": filter_month,
            "year": filter_year,
        },
    )


@router.get("/bills/{bill_id}")
async def get_bill_detail(
    bill_id: str,
    current_user: User = Depends(PermissionChecker("billing.view")),
):
    """Returns full bill detail for PDF/print with customer, salon, and payment breakdown."""
    try:
        bill_obj_id = PydanticObjectId(bill_id)
    except Exception as exc:
        raise ResourceNotFoundException("Invoice not found") from exc

    invoice_query: Dict[str, Any] = {"_id": bill_obj_id, "is_deleted": False}
    effective_tenant = tenant_context.get_tenant_id()
    if effective_tenant:
        invoice_query["tenant_id"] = effective_tenant
    invoice = await Invoice.find_one(invoice_query)
    if not invoice:
        raise ResourceNotFoundException("Invoice not found")

    invoice_data = _invoice_to_dict(invoice)
    invoice_data["whatsapp_status"] = await whatsapp_service.latest_status_for_invoice(str(invoice.id))

    customer = None
    salon = None
    try:
        customer = await Customer.find_one(
            {
                "_id": PydanticObjectId(invoice.customer_id),
                "is_deleted": False,
                **({"tenant_id": effective_tenant} if effective_tenant else {}),
            }
        )
    except Exception:
        customer = None
    try:
        salon = await Salon.find_one(
            {
                "_id": PydanticObjectId(invoice.salon_id),
                "is_deleted": False,
                **({"tenant_id": effective_tenant} if effective_tenant else {}),
            }
        )
    except Exception:
        salon = None
    # salon_id on invoices is sometimes the tenant/org id — fall back to branch by tenant
    if salon is None:
        tenant_for_salon = effective_tenant or invoice.tenant_id
        if tenant_for_salon:
            salon = await Salon.find_one(
                {"tenant_id": tenant_for_salon, "is_deleted": False}
            )

    tenant = None
    tenant_id = effective_tenant or invoice.tenant_id
    if tenant_id:
        try:
            tenant = await Tenant.get(PydanticObjectId(tenant_id))
        except Exception:
            tenant = None

    owner = None
    if tenant_id:
        owner = await User.find_one(
            {
                "tenant_id": tenant_id,
                "role": ROLE_SALON_OWNER,
                "is_deleted": False,
            }
        )

    snap_name = (invoice.salon_name or "").strip()
    if snap_name.lower() in {"", "salon", "-"}:
        snap_name = ""
    salon_name = (
        (salon.name if salon and salon.name else None)
        or snap_name
        or (tenant.name if tenant else None)
        or "Salon"
    )
    salon_phone = (
        (salon.phone if salon and salon.phone else None)
        or (invoice.salon_phone or None)
        or (owner.salon_phone_number if owner else None)
        or (owner.phone if owner else None)
    )
    salon_email = (salon.email if salon else None) or (owner.email if owner else None)
    salon_address = (salon.address if salon else None) or invoice.salon_address
    if not salon_address and owner and owner.address:
        salon_address = owner.address

    payments = await Payment.find(
        {"invoice_id": str(invoice.id), "is_deleted": False}
    ).sort("+payment_date").to_list()

    # Prefer bill-embedded payment history when present (clearest end-to-end trail).
    bill_doc = None
    if invoice.appointment_id:
        from app.models.bill import Bill

        bill_doc = await Bill.find_one(
            {"appointment_id": invoice.appointment_id, "is_deleted": False}
        )

    payment_history_payload: List[Dict[str, Any]] = []
    if bill_doc and bill_doc.payment_history:
        payment_history_payload = [
            {
                "installment_number": entry.installment_number,
                "amount": entry.amount,
                "method": entry.payment_method,
                "status_before": entry.status_before,
                "status_after": entry.status_after,
                "paid_amount_after": entry.paid_amount_after,
                "remaining_amount_after": entry.remaining_amount_after,
                "note": entry.note,
                "payment_date": entry.paid_at.isoformat() if entry.paid_at else None,
            }
            for entry in bill_doc.payment_history
        ]
    elif payments:
        running_paid = 0.0
        for idx, p in enumerate(payments, start=1):
            running_paid = float(p.paid_amount_after) if p.paid_amount_after is not None else round(running_paid + p.amount, 2)
            remaining_after = (
                float(p.remaining_amount_after)
                if p.remaining_amount_after is not None
                else round(max(float(invoice.total_amount or 0) - running_paid, 0.0), 2)
            )
            payment_history_payload.append(
                {
                    "installment_number": p.installment_number or idx,
                    "amount": p.amount,
                    "method": p.payment_method,
                    "status_before": None,
                    "status_after": p.status_after or invoice.payment_status,
                    "paid_amount_after": running_paid,
                    "remaining_amount_after": remaining_after,
                    "note": p.note,
                    "payment_date": p.payment_date.isoformat() if p.payment_date else None,
                }
            )

    tax_buckets: Dict[str, float] = {}
    services: List[Dict[str, Any]] = []
    products: List[Dict[str, Any]] = []
    for item in invoice.items:
        taxable = (item.unit_price * item.quantity) - item.discount
        item_tax = round(taxable * (item.tax_rate / 100.0), 2)
        tax_key = f"{item.tax_rate:.2f}%"
        tax_buckets[tax_key] = round(tax_buckets.get(tax_key, 0.0) + item_tax, 2)

        item_payload = {
            "item_id": item.item_id,
            "name": item.name,
            "quantity": item.quantity,
            "unit_price": item.unit_price,
            "discount": item.discount,
            "tax_rate": item.tax_rate,
            "tax_amount": item_tax,
            "staff_id": item.staff_id,
            "staff_name": item.staff_name,
            "line_total": round(taxable + item_tax, 2),
        }
        if item.item_type == "SERVICE":
            services.append(item_payload)
        else:
            products.append(item_payload)

    return success_response(
        "Bill detail retrieved successfully",
        data={
            **invoice_data,
            "salon_name": salon_name,
            "salon_phone": salon_phone,
            "salon_address": (
                ", ".join(str(v) for v in salon_address.values() if v)
                if isinstance(salon_address, dict)
                else salon_address
            ),
            "customer": {
                "id": str(customer.id) if customer else invoice.customer_id,
                "name": customer.full_name if customer else invoice.customer_name,
                "phone": customer.phone if customer else invoice.customer_phone,
                "email": customer.email if customer else None,
                "notes": customer.notes if customer else None,
            },
            "salon": {
                "id": str(salon.id) if salon else invoice.salon_id,
                "name": salon_name,
                "phone": salon_phone,
                "address": salon_address,
                "email": salon_email,
                "gst_number": None,
                "logo_url": None,
            },
            "services": services,
            "products": products,
            "tax_breakdown": [
                {"rate": rate, "amount": amount}
                for rate, amount in sorted(tax_buckets.items(), key=lambda x: x[0])
            ],
            "payments": [
                {
                    "id": str(p.id),
                    "amount": p.amount,
                    "method": p.payment_method,
                    "status": p.status,
                    "transaction_reference": p.transaction_reference,
                    "note": p.note,
                    "installment_number": p.installment_number,
                    "status_after": p.status_after,
                    "paid_amount_after": p.paid_amount_after,
                    "remaining_amount_after": p.remaining_amount_after,
                    "payment_date": p.payment_date.isoformat() if p.payment_date else None,
                }
                for p in payments
            ],
            "payment_history": payment_history_payload,
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
    payment = await billing_service.record_payment(
        invoice_id=id,
        amount=payload.amount,
        payment_method=payload.payment_method,
        transaction_reference=payload.transaction_reference
    )
    invoice = await Invoice.get(id)
    if invoice:
        tenant_id = tenant_context.get_tenant_id() or current_user.tenant_id
        recipients = await notification_service._tenant_users_for_roles(
            tenant_id,
            invoice.salon_id,
            ["salon_owner", "salon_admin", "salon_manager"],
        )
        await notification_service.create_event_notifications(
            tenant_id=tenant_id,
            salon_id=invoice.salon_id,
            recipients=recipients,
            title="Payment successful",
            body=f"Payment of {payment.amount:.2f} received for invoice {invoice.invoice_number}.",
            category="PAYMENT",
            notification_type="PAYMENT_SUCCESS",
            priority="HIGH",
            source_event="PAYMENT_SUCCESS",
            metadata={"invoice_id": id, "payment_id": str(payment.id)},
        )
    return payment


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
