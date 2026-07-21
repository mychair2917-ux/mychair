"""
Customer CRUD endpoints for the Customer Analytics module.
Provides full lifecycle management: list, detail (with history), create, update, delete.
Also supports bulk client import (CSV / XLSX / XLS) with template download.
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import Response
from beanie import PydanticObjectId

from app.api.dependencies.auth import PermissionChecker
from app.core import tenant_context
from app.core.exceptions import ResourceNotFoundException
from app.models.customer import Customer
from app.models.billing import Invoice
from app.models.appointment import Appointment
from app.models.customer_reward_transaction import CustomerRewardTransaction
from app.models.user import User
from app.services.notifications import notification_service
from app.services.customer_import import (
    CustomerImportError,
    build_csv_template,
    build_error_report_csv,
    build_xlsx_template,
    import_customers_from_file,
)
from app.utils.api_response import success_response, error_response
from app.utils.timezone import now_utc
from pydantic import BaseModel, EmailStr, Field


router = APIRouter()


# ─────────────────────────────── helpers ────────────────────────────────────

def _effective_tenant(current_user: User) -> Optional[str]:
    if current_user.role == "super_admin":
        return tenant_context.get_tenant_id()
    return str(current_user.tenant_id or "").strip() or None


def _customer_dict(c: Customer) -> dict:
    return {
        "id": str(c.id),
        "first_name": c.first_name,
        "last_name": c.last_name,
        "full_name": c.full_name.strip(),
        "phone": c.phone,
        "email": c.email,
        "gender": c.gender,
        "dob": c.dob.isoformat() if c.dob else None,
        "address": c.address,
        "notes": c.notes,
        "reward_points": c.reward_points or 0,
        "total_visits": c.total_visits or 0,
        "total_spent": c.total_spent or 0.0,
        "last_visit_at": c.last_visit_at.isoformat() if c.last_visit_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "is_deleted": c.is_deleted,
    }


# ─────────────────────────────── schemas ────────────────────────────────────

class CustomerCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(default="", max_length=50)
    phone: str = Field(..., min_length=6, max_length=20)
    email: Optional[EmailStr] = None
    gender: Optional[str] = None
    dob: Optional[str] = None          # ISO date string YYYY-MM-DD
    address: Optional[str] = None
    notes: Optional[str] = None


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(default=None, max_length=50)
    phone: Optional[str] = Field(default=None, min_length=6, max_length=20)
    email: Optional[EmailStr] = None
    gender: Optional[str] = None
    dob: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


# ─────────────────────────────── import ─────────────────────────────────────
# NOTE: These routes MUST be declared before `/{customer_id}` so "import"
# is not captured as a customer id.

@router.get("/import/template")
async def download_import_template(
    format: str = Query(default="xlsx", pattern="^(xlsx|csv)$"),
    current_user: User = Depends(PermissionChecker("customer_analytics.create")),
):
    """Download a blank client import template (Excel or CSV)."""
    _ = current_user  # permission gate + tenant context already applied
    if format == "csv":
        content = build_csv_template()
        return Response(
            content=content,
            media_type="text/csv; charset=utf-8",
            headers={
                "Content-Disposition": 'attachment; filename="client_import_template.csv"'
            },
        )
    content = build_xlsx_template()
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": 'attachment; filename="client_import_template.xlsx"'
        },
    )


@router.post("/import")
async def import_customers(
    file: UploadFile = File(...),
    current_user: User = Depends(PermissionChecker("customer_analytics.create")),
):
    """
    Bulk-import clients from CSV / XLSX / XLS.
    Duplicates (by mobile within tenant) are skipped; invalid rows are reported.
    """
    tenant_id = _effective_tenant(current_user)
    content = await file.read()
    try:
        result = await import_customers_from_file(
            content=content,
            filename=file.filename or "",
            content_type=file.content_type,
            tenant_id=tenant_id,
            current_user=current_user,
        )
    except CustomerImportError as exc:
        return error_response(exc.message, status_code=exc.status_code)

    data = result.to_dict()
    # Attach a ready-to-download error report when there are issues
    if result.errors:
        data["errorReportCsv"] = build_error_report_csv(result.errors).decode("utf-8")

    message = (
        f"Import complete: {result.inserted} inserted, "
        f"{result.duplicates} skipped, {result.failed} failed."
    )
    return success_response(message, data=data)


@router.get("")
async def list_customers(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None),
    gender: Optional[str] = Query(default=None),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    current_user: User = Depends(PermissionChecker("customer_analytics.view")),
):
    tenant_id = _effective_tenant(current_user)
    query: dict = {"is_deleted": False}
    if tenant_id:
        query["tenant_id"] = tenant_id

    if search:
        term = search.strip()
        query["$or"] = [
            {"phone": {"$regex": term, "$options": "i"}},
            {"first_name": {"$regex": term, "$options": "i"}},
            {"last_name": {"$regex": term, "$options": "i"}},
            {"email": {"$regex": term, "$options": "i"}},
        ]

    if gender:
        query["gender"] = gender.upper()

    if status_filter:
        from datetime import timedelta
        cutoff = now_utc() - timedelta(days=90)
        if status_filter.lower() == "active":
            query["last_visit_at"] = {"$gte": cutoff}
        elif status_filter.lower() == "inactive":
            query["$or"] = [
                {"last_visit_at": {"$lt": cutoff}},
                {"last_visit_at": None},
                {"last_visit_at": {"$exists": False}},
            ]

    total = await Customer.find(query).count()
    skip = (page - 1) * limit
    customers = await Customer.find(query).sort("-created_at").skip(skip).limit(limit).to_list()
    pages = max(1, (total + limit - 1) // limit)

    return success_response(
        "Customers retrieved successfully",
        data={
            "items": [_customer_dict(c) for c in customers],
            "total": total,
            "page": page,
            "pages": pages,
        },
    )


@router.get("/{customer_id}")
async def get_customer(
    customer_id: str,
    current_user: User = Depends(PermissionChecker("customer_analytics.view")),
):
    tenant_id = _effective_tenant(current_user)
    try:
        cust_oid = PydanticObjectId(customer_id)
    except Exception as exc:
        raise ResourceNotFoundException("Customer not found") from exc

    query: dict = {"_id": cust_oid, "is_deleted": False}
    if tenant_id:
        query["tenant_id"] = tenant_id

    customer = await Customer.find_one(query)
    if not customer:
        raise ResourceNotFoundException("Customer not found")

    # Appointment history (last 20)
    appt_query: dict = {"customer_id": customer_id, "is_deleted": False}
    if tenant_id:
        appt_query["tenant_id"] = tenant_id
    appointments = (
        await Appointment.find(appt_query).sort("-start_datetime").limit(20).to_list()
    )

    appointment_history = []
    for appt in appointments:
        staff_name = ""
        try:
            staff = await User.find_one(
                {"_id": PydanticObjectId(appt.staff_id), "is_deleted": False}
            )
            if staff:
                staff_name = (
                    " ".join(p for p in [staff.first_name, staff.last_name] if p).strip()
                    or staff.email
                )
        except Exception:
            pass
        service_names = ", ".join(s.name for s in (appt.services or []))
        appointment_history.append({
            "id": str(appt.id),
            "date": appt.start_datetime.isoformat(),
            "service": service_names or "—",
            "staff": staff_name or "—",
            "amount": appt.total_price or 0,
        })

    # Billing history (last 20 invoices)
    inv_query: dict = {"customer_id": customer_id, "is_deleted": False}
    if tenant_id:
        inv_query["tenant_id"] = tenant_id
    invoices = (
        await Invoice.find(inv_query).sort("-created_at").limit(20).to_list()
    )
    billing_history = [
        {
            "id": str(inv.id),
            "invoice_number": inv.invoice_number,
            "date": inv.created_at.isoformat() if inv.created_at else None,
            "amount": inv.total_amount or 0,
        }
        for inv in invoices
    ]

    # Reward transactions (last 20)
    txn_query: dict = {"customer_id": customer_id, "is_deleted": False}
    if tenant_id:
        txn_query["tenant_id"] = tenant_id
    txns = (
        await CustomerRewardTransaction.find(txn_query)
        .sort("-created_at")
        .limit(20)
        .to_list()
    )
    reward_transactions = [
        {
            "id": str(t.id),
            "date": t.created_at.isoformat() if t.created_at else None,
            "points": t.points,
            "type": t.type,
            "bill_amount": t.bill_amount,
        }
        for t in txns
    ]

    return success_response(
        "Customer retrieved successfully",
        data={
            **_customer_dict(customer),
            "appointment_history": appointment_history,
            "billing_history": billing_history,
            "reward_transactions": reward_transactions,
        },
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    current_user: User = Depends(PermissionChecker("customer_analytics.create")),
):
    tenant_id = _effective_tenant(current_user)

    # Duplicate phone check within tenant
    dup_query: dict = {"phone": payload.phone.strip(), "is_deleted": False}
    if tenant_id:
        dup_query["tenant_id"] = tenant_id
    if await Customer.find_one(dup_query):
        return error_response(
            "A customer with this mobile number already exists.",
            errors={"phone": ["Mobile number already registered"]},
            status_code=409,
        )

    dob_dt: Optional[datetime] = None
    if payload.dob:
        try:
            dob_dt = datetime.fromisoformat(payload.dob)
        except ValueError:
            return error_response("Invalid date of birth format.", status_code=422)

    customer = Customer(
        first_name=payload.first_name.strip(),
        last_name=(payload.last_name or "").strip(),
        phone=payload.phone.strip(),
        email=payload.email,
        gender=payload.gender.upper() if payload.gender else None,
        dob=dob_dt,
        address=payload.address,
        notes=payload.notes,
        tenant_id=tenant_id,
    )
    await customer.insert()
    recipients = await notification_service._tenant_users_for_roles(
        tenant_id,
        tenant_id,
        ["salon_owner", "salon_admin", "salon_manager"],
    )
    await notification_service.create_event_notifications(
        tenant_id=tenant_id,
        salon_id=tenant_id,
        recipients=recipients,
        title="New customer created",
        body=f"{customer.full_name.strip()} was added as a customer.",
        category="CUSTOMER",
        notification_type="CUSTOMER_CREATED",
        source_event="CUSTOMER_CREATED",
        metadata={"customer_id": str(customer.id)},
    )
    return success_response(
        "Customer created successfully", data=_customer_dict(customer), status_code=201
    )


@router.put("/{customer_id}")
async def update_customer(
    customer_id: str,
    payload: CustomerUpdate,
    current_user: User = Depends(PermissionChecker("customer_analytics.edit")),
):
    tenant_id = _effective_tenant(current_user)
    try:
        cust_oid = PydanticObjectId(customer_id)
    except Exception as exc:
        raise ResourceNotFoundException("Customer not found") from exc

    query: dict = {"_id": cust_oid, "is_deleted": False}
    if tenant_id:
        query["tenant_id"] = tenant_id

    customer = await Customer.find_one(query)
    if not customer:
        raise ResourceNotFoundException("Customer not found")

    if payload.first_name is not None:
        customer.first_name = payload.first_name.strip()
    if payload.last_name is not None:
        customer.last_name = payload.last_name.strip()
    if payload.phone is not None:
        # Duplicate check (exclude self)
        dup_query: dict = {
            "phone": payload.phone.strip(),
            "is_deleted": False,
            "_id": {"$ne": cust_oid},
        }
        if tenant_id:
            dup_query["tenant_id"] = tenant_id
        if await Customer.find_one(dup_query):
            return error_response(
                "Mobile number already in use by another customer.",
                errors={"phone": ["Mobile number already registered"]},
                status_code=409,
            )
        customer.phone = payload.phone.strip()
    if payload.email is not None:
        customer.email = payload.email
    if payload.gender is not None:
        customer.gender = payload.gender.upper()
    if payload.dob is not None:
        try:
            customer.dob = datetime.fromisoformat(payload.dob)
        except ValueError:
            return error_response("Invalid date of birth format.", status_code=422)
    if payload.address is not None:
        customer.address = payload.address
    if payload.notes is not None:
        customer.notes = payload.notes

    await customer.save()
    return success_response("Customer updated successfully", data=_customer_dict(customer))


@router.delete("/{customer_id}")
async def delete_customer(
    customer_id: str,
    current_user: User = Depends(PermissionChecker("customer_analytics.delete")),
):
    tenant_id = _effective_tenant(current_user)
    try:
        cust_oid = PydanticObjectId(customer_id)
    except Exception as exc:
        raise ResourceNotFoundException("Customer not found") from exc

    query: dict = {"_id": cust_oid, "is_deleted": False}
    if tenant_id:
        query["tenant_id"] = tenant_id

    customer = await Customer.find_one(query)
    if not customer:
        raise ResourceNotFoundException("Customer not found")

    customer.is_deleted = True
    customer.deleted_at = now_utc()
    await customer.save()
    return success_response("Customer deleted successfully")
