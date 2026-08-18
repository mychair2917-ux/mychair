"""
Customer CRUD endpoints for the Customer Analytics module.
Provides full lifecycle management: list, detail (with history), create, update, delete.
Also supports bulk client import (CSV / XLSX / XLS) with template download.
"""
from datetime import datetime
from typing import Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, Depends, File, Query, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field

from app.api.dependencies.auth import PermissionChecker, get_current_user
from app.auth.rbac_config import (
    ROLE_SALON_ADMIN,
    ROLE_SALON_MANAGER,
    ROLE_SALON_OWNER,
    ROLE_SUPER_ADMIN,
    normalize_role,
)
from app.core import tenant_context
from app.core.exceptions import PermissionDeniedException, ResourceNotFoundException
from app.models.appointment import Appointment
from app.models.billing import Invoice
from app.models.customer import Customer
from app.models.customer_membership import CustomerMembership
from app.utils.user_name import user_display_name
from app.models.customer_reward_transaction import CustomerRewardTransaction
from app.models.user import User
from app.services.customer_import import (
    CustomerImportError,
    build_csv_template,
    build_error_report_csv,
    build_xlsx_template,
    import_customers_from_file,
)
from app.services.customer_membership import (
    calculate_membership_dates,
    calculate_membership_dates_v2,
    calculate_renewal_dates,
    calculate_renewal_dates_v2,
    get_effective_membership_status,
    get_salon_membership_settings,
    is_membership_active,
    serialize_membership_info,
    STATUS_ACTIVE,
    STATUS_EXPIRED,
)
from app.services.customer_phone import (
    customer_display_name,
    duplicate_phone_message,
    find_client_by_phone,
    generate_client_reference_id,
)
from app.services.notifications import notification_service
from app.utils.api_response import error_response, success_response
from app.utils.phone import PHONE_INVALID, PHONE_MISSING, normalize_mobile
from app.utils.timezone import now_utc, timezone

router = APIRouter()


# ─────────────────────────────── helpers ────────────────────────────────────

def _effective_tenant(current_user: User) -> Optional[str]:
    if current_user.role == "super_admin":
        return tenant_context.get_tenant_id()
    return str(current_user.tenant_id or "").strip() or None


def _can_manage_membership(current_user: User) -> bool:
    return normalize_role(current_user.role) in {
        ROLE_SUPER_ADMIN,
        ROLE_SALON_OWNER,
        ROLE_SALON_ADMIN,
        ROLE_SALON_MANAGER,
    }


def _normalize_customer_phone(raw: str):
    """
    Normalise phone for storage/lookup.
    Returns (normalized_phone, error_message).
    """
    normalized, err = normalize_mobile(raw)
    if err == PHONE_MISSING:
        return None, "Mobile number is required."
    if err == PHONE_INVALID or not normalized:
        return None, "Enter a valid mobile number."
    return normalized, None


def _customer_dict(c: Customer) -> dict:
    membership_info = serialize_membership_info(c)
    return {
        "id": str(c.id),
        "first_name": c.first_name,
        "last_name": c.last_name,
        "full_name": c.full_name.strip(),
        "phone": c.phone,
        "email": c.email,
        "gender": c.gender,
        "dob": c.dob.isoformat() if c.dob else None,
        "anniversary_date": c.anniversary_date.isoformat() if getattr(c, "anniversary_date", None) else None,
        "address": c.address,
        "notes": c.notes,
        "reward_points": c.reward_points or 0,
        "total_visits": c.total_visits or 0,
        "total_spent": c.total_spent or 0.0,
        "last_visit_at": c.last_visit_at.isoformat() if c.last_visit_at else None,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "is_deleted": c.is_deleted,
        **membership_info,
    }


def _membership_record_dict(rec: CustomerMembership) -> dict:
    now = now_utc()
    rec_status = rec.status
    if rec_status == "ACTIVE" and rec.membership_end_date and now > rec.membership_end_date:
        rec_status = "EXPIRED"

    return {
        "id": str(rec.id),
        "customer_id": rec.customer_id,
        "membership_type": rec.membership_type,
        "membership_start_date": rec.membership_start_date.isoformat() if rec.membership_start_date else None,
        "membership_end_date": rec.membership_end_date.isoformat() if rec.membership_end_date else None,
        "duration_number": rec.duration_number,
        "duration_unit": rec.duration_unit,
        "status": rec_status,
        "created_by": rec.created_by,
        "created_by_name": rec.created_by_name or "—",
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
    }


# ─────────────────────────────── schemas ────────────────────────────────────

class CustomerCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=50)
    last_name: str = Field(default="", max_length=50)
    phone: str = Field(..., min_length=6, max_length=20)
    email: Optional[EmailStr] = None
    gender: Optional[str] = None
    dob: Optional[str] = None          # ISO date string YYYY-MM-DD
    anniversary_date: Optional[str] = None # ISO date string YYYY-MM-DD
    address: Optional[str] = None
    notes: Optional[str] = None
    is_member: bool = False
    membership_duration_number: Optional[int] = Field(default=None, ge=1)
    membership_duration_unit: Optional[str] = None
    membership_start_date: Optional[str] = None
    membership_end_date: Optional[str] = None


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    last_name: Optional[str] = Field(default=None, max_length=50)
    phone: Optional[str] = Field(default=None, min_length=6, max_length=20)
    email: Optional[EmailStr] = None
    gender: Optional[str] = None
    dob: Optional[str] = None
    anniversary_date: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_member: Optional[bool] = None
    membership_duration_number: Optional[int] = Field(default=None, ge=1)
    membership_duration_unit: Optional[str] = None
    membership_start_date: Optional[str] = None
    membership_end_date: Optional[str] = None


class CustomerMembershipCreate(BaseModel):
    duration_years: Optional[int] = Field(default=None, ge=1, le=10)
    duration_number: Optional[int] = Field(default=None, ge=1)
    duration_unit: Optional[str] = Field(default=None)
    membership_type: Optional[str] = Field(default="Standard Membership")
    start_date: Optional[str] = Field(default=None)  # YYYY-MM-DD or ISO format


class CustomerMembershipRenew(BaseModel):
    duration_years: Optional[int] = Field(default=None, ge=1, le=10)
    duration_number: Optional[int] = Field(default=None, ge=1)
    duration_unit: Optional[str] = Field(default=None)
    membership_type: Optional[str] = Field(default=None)


# ─────────────────────────────── import / utilities ─────────────────────────────
# NOTE: These routes MUST be declared before `/{customer_id}` so "import" / "generate-id"
# is not captured as a customer id.

@router.get("/generate-id")
async def generate_customer_id(
    current_user: User = Depends(PermissionChecker("customer_analytics.create")),
):
    """
    Generate a unique alphanumeric client reference ID (CL-XXXXXX).
    """
    tenant_id = _effective_tenant(current_user)
    client_id = await generate_client_reference_id(tenant_id)
    return success_response(
        "Client ID generated successfully",
        data={"client_id": client_id},
    )


@router.get("/check-phone")
async def check_customer_phone(
    phone: str = Query(..., min_length=5, max_length=20),
    exclude_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("customer_analytics.create")),
):
    """
    Pre-submit duplicate phone check for Customer Analytics forms.
    Returns whether the phone is already registered in this tenant.
    """
    tenant_id = _effective_tenant(current_user)
    normalized, norm_err = _normalize_customer_phone(phone)
    if norm_err or not normalized:
        return success_response(
            "Phone checked",
            data={"exists": False, "clientName": None, "valid": False, "message": norm_err},
        )

    exclude_oid = None
    if exclude_id:
        try:
            exclude_oid = PydanticObjectId(exclude_id)
        except Exception:
            exclude_oid = None

    existing = await find_client_by_phone(normalized, tenant_id, exclude_id=exclude_oid)
    if existing:
        name = customer_display_name(existing)
        return success_response(
            "Phone already registered",
            data={
                "exists": True,
                "clientName": name,
                "valid": True,
                "message": duplicate_phone_message(name),
            },
        )
    return success_response(
        "Phone available",
        data={"exists": False, "clientName": None, "valid": True, "message": None},
    )

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
    membership: Optional[str] = Query(
        default=None,
        description="Filter by membership: members | non_members",
    ),
    current_user: User = Depends(PermissionChecker("customer_analytics.view")),
):
    tenant_id = _effective_tenant(current_user)
    query: dict = {"is_deleted": False}
    if tenant_id:
        query["tenant_id"] = tenant_id

    and_clauses: list = []

    if search:
        term = search.strip()
        and_clauses.append(
            {
                "$or": [
                    {"phone": {"$regex": term, "$options": "i"}},
                    {"first_name": {"$regex": term, "$options": "i"}},
                    {"last_name": {"$regex": term, "$options": "i"}},
                    {"email": {"$regex": term, "$options": "i"}},
                ]
            }
        )

    if gender:
        query["gender"] = gender.upper()

    if membership:
        membership_key = membership.strip().lower().replace("-", "_")
        now = now_utc()
        if membership_key in {"active", "active_members", "members", "member"}:
            and_clauses.append(
                {
                    "$or": [
                        {"membership_end_date": {"$gte": now}},
                        {
                            "$and": [
                                {"is_member": True},
                                {
                                    "$or": [
                                        {"membership_end_date": None},
                                        {"membership_end_date": {"$exists": False}},
                                    ]
                                },
                            ]
                        },
                    ]
                }
            )
        elif membership_key in {"expired", "expired_members"}:
            query["membership_end_date"] = {"$lt": now}
        elif membership_key in {"expiring_soon", "expiring"}:
            from datetime import timedelta
            in_30_days = now + timedelta(days=30)
            query["membership_end_date"] = {"$gte": now, "$lte": in_30_days}
        elif membership_key in {"non_members", "non_member", "nonmembers"}:
            and_clauses.append(
                {
                    "$or": [
                        {"membership_end_date": {"$lt": now}},
                        {
                            "$and": [
                                {"is_member": False},
                                {
                                    "$or": [
                                        {"membership_end_date": None},
                                        {"membership_end_date": {"$exists": False}},
                                    ]
                                },
                            ]
                        },
                        {
                            "$and": [
                                {"membership_status": "NON_MEMBER"},
                                {
                                    "$or": [
                                        {"membership_end_date": None},
                                        {"membership_end_date": {"$exists": False}},
                                    ]
                                },
                            ]
                        },
                    ]
                }
            )

    if status_filter:
        from datetime import timedelta
        cutoff = now_utc() - timedelta(days=90)
        if status_filter.lower() == "active":
            query["last_visit_at"] = {"$gte": cutoff}
        elif status_filter.lower() == "inactive":
            and_clauses.append(
                {
                    "$or": [
                        {"last_visit_at": {"$lt": cutoff}},
                        {"last_visit_at": None},
                        {"last_visit_at": {"$exists": False}},
                    ]
                }
            )

    if and_clauses:
        query["$and"] = and_clauses

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
                staff_name = user_display_name(staff)
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

    # Membership history
    membership_records = (
        await CustomerMembership.find(
            {"customer_id": str(customer.id), "is_deleted": False}
        )
        .sort("-created_at")
        .to_list()
    )
    membership_history = [_membership_record_dict(r) for r in membership_records]

    return success_response(
        "Customer retrieved successfully",
        data={
            **_customer_dict(customer),
            "appointment_history": appointment_history,
            "billing_history": billing_history,
            "reward_transactions": reward_transactions,
            "membership_history": membership_history,
        },
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_customer(
    payload: CustomerCreate,
    current_user: User = Depends(PermissionChecker("customer_analytics.create")),
):
    tenant_id = _effective_tenant(current_user)

    normalized_phone, phone_err = _normalize_customer_phone(payload.phone)
    if phone_err or not normalized_phone:
        return error_response(
            phone_err or "Enter a valid mobile number.",
            errors={"phone": [phone_err or "Enter a valid mobile number."]},
            status_code=422,
        )

    # Duplicate phone check within tenant (shared helper)
    existing = await find_client_by_phone(normalized_phone, tenant_id)
    if existing:
        name = customer_display_name(existing)
        message = duplicate_phone_message(name)
        return error_response(
            message,
            errors={"phone": [message]},
            status_code=409,
        )

    dob_dt: Optional[datetime] = None
    if payload.dob:
        try:
            dob_dt = datetime.fromisoformat(payload.dob)
        except ValueError:
            return error_response("Invalid date of birth format.", status_code=422)

    anniversary_dt: Optional[datetime] = None
    if payload.anniversary_date:
        try:
            anniversary_dt = datetime.fromisoformat(payload.anniversary_date)
        except ValueError:
            return error_response("Invalid anniversary date format.", status_code=422)

    if payload.is_member and not _can_manage_membership(current_user):
        raise PermissionDeniedException(
            detail="Only Super Admin, Salon Owner, or Salon Manager can mark a client as a member"
        )

    is_mem = bool(payload.is_member)
    start_date, end_date = (None, None)
    duration_num = None
    duration_unit = None

    if is_mem:
        if payload.membership_duration_number and payload.membership_duration_unit:
            duration_num = payload.membership_duration_number
            duration_unit = payload.membership_duration_unit.strip().capitalize()
            if not duration_unit.endswith("s"):
                duration_unit += "s"
            if duration_unit not in {"Days", "Months", "Years"}:
                return error_response("Invalid membership duration unit.", status_code=422)
        else:
            settings = await get_salon_membership_settings(tenant_id)
            duration_num = settings.default_duration_number
            duration_unit = settings.default_duration_unit

        start_dt = None
        if payload.membership_start_date:
            try:
                start_dt = datetime.fromisoformat(payload.membership_start_date.strip())
            except ValueError:
                return error_response("Invalid membership start date format.", status_code=422)

        start_date, end_date = calculate_membership_dates_v2(
            start_date=start_dt,
            duration_number=duration_num,
            duration_unit=duration_unit,
        )

        if payload.membership_end_date and payload.membership_end_date.strip():
            try:
                raw_dt = datetime.fromisoformat(payload.membership_end_date.strip())
                end_date = raw_dt.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
            except ValueError:
                return error_response("Invalid membership expiry date format.", status_code=422)

    customer = Customer(
        first_name=payload.first_name.strip(),
        last_name=(payload.last_name or "").strip(),
        phone=normalized_phone,
        email=payload.email,
        gender=payload.gender.upper() if payload.gender else None,
        dob=dob_dt,
        anniversary_date=anniversary_dt,
        address=payload.address,
        notes=payload.notes,
        is_member=is_mem,
        membership_status="ACTIVE" if is_mem else "NON_MEMBER",
        membership_start_date=start_date,
        membership_end_date=end_date,
        membership_duration=duration_num,
        membership_duration_unit=duration_unit,
        membership_type="Standard Membership" if is_mem else None,
        membership_created_by=str(current_user.id) if is_mem else None,
        membership_created_at=now_utc() if is_mem else None,
        membership_updated_at=now_utc() if is_mem else None,
        tenant_id=tenant_id,
    )
    await customer.insert()

    if is_mem:
        membership_record = CustomerMembership(
            customer_id=str(customer.id),
            membership_type="Standard Membership",
            membership_start_date=start_date,
            membership_end_date=end_date,
            duration_number=duration_num,
            duration_unit=duration_unit,
            status="ACTIVE",
            tenant_id=customer.tenant_id,
            created_by_name=user_display_name(current_user),
        )
        await membership_record.insert()

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
        normalized_phone, phone_err = _normalize_customer_phone(payload.phone)
        if phone_err or not normalized_phone:
            return error_response(
                phone_err or "Enter a valid mobile number.",
                errors={"phone": [phone_err or "Enter a valid mobile number."]},
                status_code=422,
            )
        existing = await find_client_by_phone(
            normalized_phone, tenant_id, exclude_id=cust_oid
        )
        if existing:
            name = customer_display_name(existing)
            message = duplicate_phone_message(name)
            return error_response(
                message,
                errors={"phone": [message]},
                status_code=409,
            )
        customer.phone = normalized_phone
    if payload.email is not None:
        customer.email = payload.email
    if payload.gender is not None:
        customer.gender = payload.gender.upper()
    if payload.dob is not None:
        try:
            customer.dob = datetime.fromisoformat(payload.dob)
        except ValueError:
            return error_response("Invalid date of birth format.", status_code=422)
    if payload.anniversary_date is not None:
        if payload.anniversary_date.strip():
            try:
                customer.anniversary_date = datetime.fromisoformat(payload.anniversary_date.strip())
            except ValueError:
                return error_response("Invalid anniversary date format.", status_code=422)
        else:
            customer.anniversary_date = None
    if payload.address is not None:
        customer.address = payload.address
    if payload.notes is not None:
        customer.notes = payload.notes

    if payload.membership_end_date is not None:
        if payload.membership_end_date.strip():
            try:
                raw_dt = datetime.fromisoformat(payload.membership_end_date.strip())
                end_date = raw_dt.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
                customer.membership_end_date = end_date
                customer.is_member = True
                customer.membership_status = "ACTIVE" if end_date >= now_utc() else "EXPIRED"
                customer.membership_updated_at = now_utc()
            except ValueError:
                return error_response("Invalid membership expiry date format.", status_code=422)
        else:
            customer.membership_end_date = None

    if payload.is_member is not None:
        current_member = bool(getattr(customer, "is_member", False))
        target_member = bool(payload.is_member)
        if target_member != current_member and not _can_manage_membership(current_user):
            raise PermissionDeniedException(
                detail="Only Super Admin, Salon Owner, or Salon Manager can change client membership"
            )
        customer.is_member = target_member
        if target_member:
            duration_changed = (
                payload.membership_duration_number is not None
                or payload.membership_duration_unit is not None
            )
            if not current_member or duration_changed or customer.membership_end_date is None:
                duration_num = payload.membership_duration_number or getattr(customer, "membership_duration", None)
                duration_unit = payload.membership_duration_unit or getattr(customer, "membership_duration_unit", None)
                if not duration_num or not duration_unit:
                    settings = await get_salon_membership_settings(tenant_id)
                    duration_num = duration_num or settings.default_duration_number
                    duration_unit = duration_unit or settings.default_duration_unit

                norm_unit = duration_unit.strip().capitalize()
                if not norm_unit.endswith("s"):
                    norm_unit += "s"

                start_dt = None
                if payload.membership_start_date:
                    try:
                        start_dt = datetime.fromisoformat(payload.membership_start_date.strip())
                    except ValueError:
                        return error_response("Invalid membership start date format.", status_code=422)
                else:
                    start_dt = customer.membership_start_date or now_utc()

                s_dt, e_dt = calculate_membership_dates_v2(
                    start_date=start_dt,
                    duration_number=duration_num,
                    duration_unit=norm_unit,
                )

                if payload.membership_end_date and payload.membership_end_date.strip():
                    try:
                        raw_dt = datetime.fromisoformat(payload.membership_end_date.strip())
                        e_dt = raw_dt.replace(hour=23, minute=59, second=59, microsecond=999999, tzinfo=timezone.utc)
                    except ValueError:
                        return error_response("Invalid membership expiry date format.", status_code=422)

                customer.membership_start_date = s_dt
                customer.membership_end_date = e_dt
                customer.membership_duration = duration_num
                customer.membership_duration_unit = norm_unit
                customer.membership_type = customer.membership_type or "Standard Membership"
                customer.membership_created_by = customer.membership_created_by or str(current_user.id)
                customer.membership_updated_at = now_utc()
                customer.membership_status = "ACTIVE" if e_dt >= now_utc() else "EXPIRED"

                membership_record = CustomerMembership(
                    customer_id=str(customer.id),
                    membership_type=customer.membership_type,
                    membership_start_date=s_dt,
                    membership_end_date=e_dt,
                    duration_number=duration_num,
                    duration_unit=norm_unit,
                    status="ACTIVE",
                    tenant_id=customer.tenant_id,
                    created_by_name=user_display_name(current_user),
                )
                await membership_record.insert()
            else:
                customer.membership_status = "ACTIVE" if customer.membership_end_date >= now_utc() else "EXPIRED"
        else:
            customer.membership_status = "NON_MEMBER"

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


# ─────────────────────────────── membership management ─────────────────────────

@router.post("/{customer_id}/membership", status_code=status.HTTP_201_CREATED)
async def add_customer_membership(
    customer_id: str,
    payload: CustomerMembershipCreate = CustomerMembershipCreate(),
    current_user: User = Depends(get_current_user),
):
    if not _can_manage_membership(current_user):
        raise PermissionDeniedException("Only Super Admin, Salon Owner, or Manager can manage memberships")

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

    if is_membership_active(customer):
        return error_response(
            "Client already has an active membership. Use renewal/extension instead.",
            status_code=409,
        )

    start_dt: Optional[datetime] = None
    if payload.start_date:
        try:
            start_dt = datetime.fromisoformat(payload.start_date)
        except ValueError:
            return error_response("Invalid start date format. Use YYYY-MM-DD.", status_code=422)

    duration_num = payload.duration_number
    duration_unit = payload.duration_unit
    if not duration_num or not duration_unit:
        if payload.duration_years:
            duration_num = payload.duration_years
            duration_unit = "Years"
        else:
            settings = await get_salon_membership_settings(tenant_id)
            duration_num = settings.default_duration_number
            duration_unit = settings.default_duration_unit

    norm_unit = duration_unit.strip().capitalize()
    if not norm_unit.endswith("s"):
        norm_unit += "s"

    start_date, end_date = calculate_membership_dates_v2(
        start_date=start_dt,
        duration_number=duration_num,
        duration_unit=norm_unit,
    )
    m_type = (payload.membership_type or "Standard Membership").strip()
    creator_name = user_display_name(current_user)

    membership_record = CustomerMembership(
        customer_id=str(customer.id),
        membership_type=m_type,
        membership_start_date=start_date,
        membership_end_date=end_date,
        duration_number=duration_num,
        duration_unit=norm_unit,
        status="ACTIVE",
        tenant_id=customer.tenant_id,
        created_by_name=creator_name,
    )
    await membership_record.insert()

    customer.is_member = True
    customer.membership_status = "ACTIVE"
    customer.membership_start_date = start_date
    customer.membership_end_date = end_date
    customer.membership_duration = duration_num
    customer.membership_duration_unit = norm_unit
    customer.membership_type = m_type
    customer.membership_created_by = str(current_user.id)
    customer.membership_created_at = now_utc()
    customer.membership_updated_at = now_utc()
    await customer.save()

    return success_response(
        "Membership enrolled successfully",
        data={
            "membership": _membership_record_dict(membership_record),
            "customer": _customer_dict(customer),
        },
        status_code=201,
    )


@router.post("/{customer_id}/membership/renew")
async def renew_customer_membership(
    customer_id: str,
    payload: CustomerMembershipRenew = CustomerMembershipRenew(),
    current_user: User = Depends(get_current_user),
):
    if not _can_manage_membership(current_user):
        raise PermissionDeniedException("Only Super Admin, Salon Owner, or Manager can manage memberships")

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

    prev_records = await CustomerMembership.find(
        {"customer_id": str(customer.id), "status": "ACTIVE", "is_deleted": False}
    ).to_list()
    now = now_utc()
    for rec in prev_records:
        if rec.membership_end_date and now > rec.membership_end_date:
            rec.status = "EXPIRED"
            await rec.save()

    duration_num = payload.duration_number
    duration_unit = payload.duration_unit
    if not duration_num or not duration_unit:
        if payload.duration_years:
            duration_num = payload.duration_years
            duration_unit = "Years"
        else:
            settings = await get_salon_membership_settings(tenant_id)
            duration_num = settings.default_duration_number
            duration_unit = settings.default_duration_unit

    norm_unit = duration_unit.strip().capitalize()
    if not norm_unit.endswith("s"):
        norm_unit += "s"

    start_date, end_date = calculate_renewal_dates_v2(
        customer,
        duration_number=duration_num,
        duration_unit=norm_unit,
    )
    m_type = (payload.membership_type or customer.membership_type or "Standard Membership").strip()
    creator_name = user_display_name(current_user)

    membership_record = CustomerMembership(
        customer_id=str(customer.id),
        membership_type=m_type,
        membership_start_date=start_date,
        membership_end_date=end_date,
        duration_number=duration_num,
        duration_unit=norm_unit,
        status="ACTIVE",
        tenant_id=customer.tenant_id,
        created_by_name=creator_name,
    )
    await membership_record.insert()

    customer.is_member = True
    customer.membership_status = "ACTIVE"
    customer.membership_start_date = start_date
    customer.membership_end_date = end_date
    customer.membership_duration = duration_num
    customer.membership_duration_unit = norm_unit
    customer.membership_type = m_type
    customer.membership_created_by = str(current_user.id)
    customer.membership_updated_at = now_utc()
    if not customer.membership_created_at:
        customer.membership_created_at = now_utc()
    await customer.save()

    return success_response(
        "Membership renewed successfully",
        data={
            "membership": _membership_record_dict(membership_record),
            "customer": _customer_dict(customer),
        },
    )


@router.get("/{customer_id}/membership")
async def get_customer_membership(
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

    membership_records = await CustomerMembership.find(
        {"customer_id": str(customer.id), "is_deleted": False}
    ).sort("-created_at").to_list()

    history = [_membership_record_dict(r) for r in membership_records]
    info = serialize_membership_info(customer)

    return success_response(
        "Customer membership details retrieved successfully",
        data={
            **info,
            "customer_id": str(customer.id),
            "customer_name": customer.full_name.strip(),
            "history": history,
        },
    )


@router.get("/{customer_id}/membership/history")
async def get_customer_membership_history(
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

    membership_records = await CustomerMembership.find(
        {"customer_id": str(customer.id), "is_deleted": False}
    ).sort("-created_at").to_list()

    history = [_membership_record_dict(r) for r in membership_records]

    return success_response(
        "Customer membership history retrieved successfully",
        data={
            "customer_id": str(customer.id),
            "history": history,
        },
    )
