import re
from datetime import datetime, timedelta
from typing import List, Optional

from beanie import PydanticObjectId
from fastapi import APIRouter, BackgroundTasks, Depends, Query, status

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
from app.models.brand import Brand
from app.models.customer import Customer
from app.models.product import Product
from app.models.salon_product import SalonProduct
from app.models.salon_service import SalonService
from app.models.service import Service
from app.models.user import User
from app.repositories.appointment import AppointmentRepository
from app.utils.user_name import user_display_name
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentPaymentUpdate,
    AppointmentResponse,
    AppointmentStatusUpdate,
    CustomerQuickCreate,
    FrontDeskAppointmentCreate,
    QuickAppointmentCreate,
)
from app.services.appointment import AppointmentService
from app.services.appointment_list_rows import (
    expand_appointment_items_to_list_rows,
    row_matches_search,
)
from app.services.customer_phone import (
    customer_display_name,
    duplicate_phone_message,
    find_client_by_phone,
    generate_client_reference_id,
)
from app.models.customer_membership import CustomerMembership
from app.services.customer_membership import (
    calculate_membership_dates_v2,
    get_salon_membership_settings,
)
from app.services.notifications import notification_service
from app.services.websocket import manager
from app.services.whatsapp import WhatsAppService
from app.utils.api_response import error_response, success_response
from app.utils.phone import PHONE_INVALID, PHONE_MISSING, normalize_mobile, phone_lookup_variants
from app.utils.timezone import make_aware, now_utc, to_utc_iso, timezone

router = APIRouter()
appointment_service = AppointmentService()
appointment_repo = AppointmentRepository()
whatsapp_service = WhatsAppService()


def _normalize_client_phone(raw: str):
    normalized, err = normalize_mobile(raw)
    if err == PHONE_MISSING:
        return None, "Mobile number is required."
    if err == PHONE_INVALID or not normalized:
        return None, "Enter a valid mobile number."
    return normalized, None


def _client_search_or_clauses(term: str) -> List[dict]:
    """Build Mongo $or clauses that match phone, name parts, full name, or email."""
    escaped = re.escape(term)
    clauses: List[dict] = [
        {"phone": {"$regex": escaped, "$options": "i"}},
        {"first_name": {"$regex": escaped, "$options": "i"}},
        {"last_name": {"$regex": escaped, "$options": "i"}},
        {"email": {"$regex": escaped, "$options": "i"}},
        {
            "$expr": {
                "$regexMatch": {
                    "input": {
                        "$trim": {
                            "input": {
                                "$concat": [
                                    {"$ifNull": ["$first_name", ""]},
                                    " ",
                                    {"$ifNull": ["$last_name", ""]},
                                ]
                            }
                        }
                    },
                    "regex": escaped,
                    "options": "i",
                }
            }
        },
    ]

    parts = [p for p in term.split() if p]
    if len(parts) >= 2:
        first = re.escape(parts[0])
        last = re.escape(" ".join(parts[1:]))
        clauses.append(
            {
                "$and": [
                    {"first_name": {"$regex": first, "$options": "i"}},
                    {"last_name": {"$regex": last, "$options": "i"}},
                ]
            }
        )

    digits = re.sub(r"\D", "", term)
    if len(digits) >= 4:
        clauses.append({"phone": {"$regex": re.escape(digits)}})
        normalized, err = normalize_mobile(term)
        if not err and normalized:
            variants = phone_lookup_variants(normalized)
            clauses.append({"phone": {"$in": variants}})
            clauses.append({"phone": {"$regex": re.escape(normalized)}})

    return clauses


def _resolve_salon_scope(current_user: User, salon_id: Optional[str]) -> str:
    if current_user.role == "super_admin":
        resolved = (salon_id or "").strip()
        if not resolved:
            raise ResourceNotFoundException("Salon is required")
        return resolved
    resolved = str(current_user.tenant_id or "").strip()
    if not resolved:
        raise ResourceNotFoundException("Salon is required")
    return resolved


def _effective_tenant_id(current_user: User) -> Optional[str]:
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


def _can_edit_appointment(current_user: User) -> bool:
    return normalize_role(current_user.role) in {ROLE_SUPER_ADMIN, ROLE_SALON_OWNER}


def _customer_response(customer: Customer) -> dict:
    return {
        "id": str(customer.id),
        "name": customer.full_name.strip(),
        "phone": customer.phone,
        "email": customer.email,
        "gender": customer.gender,
        "dob": customer.dob.isoformat() if customer.dob else None,
        "anniversary_date": customer.anniversary_date.isoformat() if getattr(customer, "anniversary_date", None) else None,
        "is_member": bool(getattr(customer, "is_member", False)),
    }


async def _appointment_response(appointment: Appointment) -> dict:
    customer = None
    if appointment.customer_id:
        try:
            customer = await Customer.find_one(
                {"_id": PydanticObjectId(appointment.customer_id), "is_deleted": False}
            )
        except Exception:
            customer = None

    staff = None
    if appointment.staff_id:
        try:
            staff = await User.find_one(
                {"_id": PydanticObjectId(appointment.staff_id), "is_deleted": False}
            )
        except Exception:
            staff = None

    staff_name = None
    if staff:
        staff_name = user_display_name(staff)

    customer_name = "Deleted Customer"
    customer_phone = ""
    if customer:
        customer_name = customer.full_name.strip() or "Unnamed Customer"
        customer_phone = customer.phone or ""

    return {
        "id": str(appointment.id),
        "salon_id": appointment.salon_id,
        "customer_id": appointment.customer_id,
        "customer_name": customer_name,
        "customer_phone": customer_phone,
        "staff_id": appointment.staff_id,
        "staff_name": staff_name,
        "start_datetime": to_utc_iso(appointment.start_datetime),
        "end_datetime": to_utc_iso(appointment.end_datetime),
        "total_price": appointment.total_price,
        "status": appointment.status,
        "notes": appointment.notes,
        "booking_source": appointment.booking_source,
        "payment_type": appointment.payment_type,
        "payment_status": appointment.payment_status,
        "paid_amount": appointment.paid_amount,
        "whatsapp_status": await whatsapp_service.latest_status_for_appointment(str(appointment.id)),
        "services": [
            {
                "service_id": service.service_id,
                "name": service.name,
                "price": service.price,
                "duration_minutes": service.duration_minutes,
                "tax_rate": service.tax_rate,
                "pricing_type": getattr(service, "pricing_type", None),
                "staff_id": service.staff_id,
                "staff_name": service.staff_name,
            }
            for service in appointment.services
        ],
        "products": [
            {
                "product_id": product.product_id,
                "name": product.name,
                "price": product.price,
                "tax_rate": product.tax_rate,
                "quantity": max(int(getattr(product, "quantity", 1) or 1), 1),
                "staff_id": product.staff_id,
                "staff_name": product.staff_name,
            }
            for product in appointment.products
        ],
    }


@router.get("/clients")
async def search_clients(
    search: str = Query(default="", min_length=1),
    current_user: User = Depends(PermissionChecker("appointments.view")),
):
    term = search.strip()
    if not term:
        return success_response("Clients retrieved successfully", data=[])

    query: dict = {
        "$or": _client_search_or_clauses(term),
        "is_deleted": False,
    }
    effective_tenant_id = _effective_tenant_id(current_user)
    if effective_tenant_id:
        query["tenant_id"] = effective_tenant_id
    
    customers = await Customer.find(query).limit(50).to_list()

    def get_relevance_score(c: Customer) -> tuple:
        term_lower = term.lower()
        full_name_lower = c.full_name.strip().lower()
        first_name_lower = (c.first_name or "").strip().lower()
        last_name_lower = (c.last_name or "").strip().lower()
        phone = c.phone or ""
        email_lower = (c.email or "").strip().lower()
        
        digits_term = re.sub(r"\D", "", term)
        
        # 1. Exact phone number match
        if digits_term and (phone == term or phone == digits_term):
            return (0, 0, len(phone))
        
        # 2. Phone number starts with search text
        if digits_term and phone.startswith(digits_term):
            return (1, 0, len(phone))
        if phone.startswith(term):
            return (1, 1, len(phone))
            
        # 3. Exact client name match
        if full_name_lower == term_lower:
            return (2, 0, len(full_name_lower))
            
        # 4. Client name starts with search text
        if full_name_lower.startswith(term_lower) or first_name_lower.startswith(term_lower):
            return (3, 0, len(full_name_lower))
        if last_name_lower.startswith(term_lower):
            return (3, 1, len(full_name_lower))
            
        # 5. Client name contains search text
        if term_lower in full_name_lower:
            idx = full_name_lower.find(term_lower)
            return (4, idx, len(full_name_lower))
            
        # 6. Other partial matches
        if term_lower in phone or (digits_term and digits_term in phone):
            return (5, 0, len(phone))
        if term_lower in email_lower:
            return (5, 1, len(email_lower))
            
        return (6, 0, len(full_name_lower))

    customers.sort(key=get_relevance_score)
    top_customers = customers[:10]

    return success_response("Clients retrieved successfully", data=[_customer_response(c) for c in top_customers])


@router.get("/clients/generate-id")
async def generate_appointment_client_id(
    current_user: User = Depends(PermissionChecker("appointments.create")),
):
    """Generate a unique alphanumeric client reference ID (CL-XXXXXX)."""
    tenant_id = _effective_tenant_id(current_user)
    client_id = await generate_client_reference_id(tenant_id)
    return success_response(
        "Client ID generated successfully",
        data={"client_id": client_id},
    )


@router.get("/clients/check-phone")
async def check_client_phone(
    phone: str = Query(..., min_length=5, max_length=20),
    current_user: User = Depends(PermissionChecker("appointments.create")),
):
    """Pre-submit duplicate phone check for Appointment Quick Add Client."""
    tenant_id = _effective_tenant_id(current_user)
    normalized, norm_err = _normalize_client_phone(phone)
    if norm_err or not normalized:
        return success_response(
            "Phone checked",
            data={"exists": False, "clientName": None, "valid": False, "message": norm_err},
        )
    existing = await find_client_by_phone(normalized, tenant_id)
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


@router.post("/clients", status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: CustomerQuickCreate,
    current_user: User = Depends(PermissionChecker("appointments.create")),
):
    if payload.is_member and not _can_manage_membership(current_user):
        raise PermissionDeniedException(
            detail="Only Salon Owner, Admin or Manager can mark a client as a member"
        )

    normalized_phone, phone_err = _normalize_client_phone(payload.phone)
    if phone_err or not normalized_phone:
        return error_response(
            phone_err or "Enter a valid mobile number.",
            errors={"phone": [phone_err or "Enter a valid mobile number."]},
            status_code=422,
        )

    tenant_id = _effective_tenant_id(current_user)
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
            pass

    anniversary_dt: Optional[datetime] = None
    if payload.anniversary_date:
        try:
            anniversary_dt = datetime.fromisoformat(payload.anniversary_date)
        except ValueError:
            pass

    is_mem = bool(payload.is_member)
    start_date, end_date = None, None
    duration_num, duration_unit = None, None

    if is_mem:
        if payload.membership_duration_number and payload.membership_duration_unit:
            duration_num = payload.membership_duration_number
            duration_unit = payload.membership_duration_unit.strip().capitalize()
            if not duration_unit.endswith("s"):
                duration_unit += "s"
        else:
            settings = await get_salon_membership_settings(tenant_id)
            duration_num = settings.default_duration_number
            duration_unit = settings.default_duration_unit

        start_dt = None
        if payload.membership_start_date:
            try:
                start_dt = datetime.fromisoformat(payload.membership_start_date.strip())
            except ValueError:
                pass

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
                pass

    name_parts = payload.name.strip().split(maxsplit=1)
    customer = Customer(
        first_name=name_parts[0],
        last_name=name_parts[1] if len(name_parts) > 1 else "",
        phone=normalized_phone,
        email=payload.email.strip() if payload.email else None,
        gender=payload.gender,
        dob=dob_dt,
        anniversary_date=anniversary_dt,
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

    return success_response("Client created successfully", data=_customer_response(customer), status_code=201)


@router.get("/clients/{customer_id}/history")
async def get_client_history(
    customer_id: str,
    salon_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("appointments.view")),
):
    resolved_salon_id = None
    if salon_id:
        resolved_salon_id = _resolve_salon_scope(current_user, salon_id)

    customer = await appointment_service.get_customer_for_history(
        customer_id=customer_id,
        current_user=current_user,
        salon_id=resolved_salon_id,
    )
    history = await appointment_repo.get_customer_history_for_salon(
        str(customer.id),
        salon_id=resolved_salon_id,
        limit=5,
    )
    return success_response(
        "Client history retrieved successfully",
        data=[await appointment_service.build_history_response(item, customer=customer) for item in history],
    )


@router.get("/services")
async def list_services(
    current_user: User = Depends(PermissionChecker("appointments.view")),
):
    query = {"is_deleted": False, "is_active": True}
    effective_tenant_id = _effective_tenant_id(current_user)
    if effective_tenant_id:
        query["tenant_id"] = effective_tenant_id
    services = await Service.find(query).sort("name").to_list()
    return success_response(
        "Services retrieved successfully",
        data=[
            {
                "id": str(service.id),
                "name": service.name,
                "category": service.category,
                "price": service.price,
                "duration_minutes": service.duration_minutes,
            }
            for service in services
        ],
    )


@router.get("/salon-services")
async def list_salon_services_for_appointments(
    salon_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("appointments.view")),
):
    resolved_salon_id = _resolve_salon_scope(current_user, salon_id)
    salon_services = await SalonService.find(
        SalonService.salon_id == resolved_salon_id,
        SalonService.is_deleted == False,
        SalonService.status == "ACTIVE",
    ).sort("-created_at").to_list()

    master_service_ids = []
    for service in salon_services:
        if not service.service_id:
            continue
        try:
            master_service_ids.append(PydanticObjectId(service.service_id))
        except Exception:
            continue
    master_services = []
    if master_service_ids:
        master_services = await Service.find(
            {"_id": {"$in": master_service_ids}, "is_deleted": False}
        ).to_list()
    master_service_map = {str(item.id): item for item in master_services}

    payload = []
    for salon_service in salon_services:
        service_name = (
            master_service_map.get(salon_service.service_id).name
            if salon_service.service_id and master_service_map.get(salon_service.service_id)
            else salon_service.custom_service_name
        ) or "-"
        payload.append(
            {
                "salon_service_id": str(salon_service.id),
                "service_name": service_name,
                "price": salon_service.price,
                "member_price": getattr(salon_service, "member_price", None),
                "service_id": salon_service.service_id,
            }
        )

    return success_response("Salon services retrieved successfully", data=payload)


@router.get("/salon-products")
async def list_salon_products_for_appointments(
    salon_id: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("appointments.view")),
):
    resolved_salon_id = _resolve_salon_scope(current_user, salon_id)
    
    # Ensure inventory is created and synchronized
    from app.services.inventory import InventoryService
    inventory_service = InventoryService()
    await inventory_service._ensure_salon_products_inventory(resolved_salon_id)

    salon_products = await SalonProduct.find(
        SalonProduct.salon_id == resolved_salon_id,
        SalonProduct.is_deleted == False,
        SalonProduct.status == "ACTIVE",
    ).sort("-created_at").to_list()

    master_product_ids = []
    for product in salon_products:
        if not product.product_id:
            continue
        try:
            master_product_ids.append(PydanticObjectId(product.product_id))
        except Exception:
            continue
    master_products = []
    if master_product_ids:
        master_products = await Product.find(
            {"_id": {"$in": master_product_ids}, "is_deleted": False}
        ).to_list()
    master_product_map = {str(item.id): item for item in master_products}
    brand_ids = []
    for product in salon_products:
        if not product.brand_id:
            continue
        try:
            brand_ids.append(PydanticObjectId(product.brand_id))
        except Exception:
            continue
    brands = []
    if brand_ids:
        brands = await Brand.find({"_id": {"$in": brand_ids}, "is_deleted": False}).to_list()
    brand_map = {str(item.id): item for item in brands}

    from app.models.inventory import ProductInventory
    inventories = await ProductInventory.find(
        {"salon_id": resolved_salon_id, "is_deleted": False}
    ).to_list()
    inventory_map = {(inv.product_id, inv.brand_id): inv.stock_quantity for inv in inventories}

    payload = []
    for salon_product in salon_products:
        base_product_name = (
            master_product_map.get(salon_product.product_id).name
            if salon_product.product_id and master_product_map.get(salon_product.product_id)
            else salon_product.custom_product_name
        ) or "-"
        brand_name = (
            brand_map.get(salon_product.brand_id).name
            if salon_product.brand_id and brand_map.get(salon_product.brand_id)
            else salon_product.custom_brand_name
        )
        product_name = (
            f"{base_product_name} ({brand_name})" if brand_name else base_product_name
        )
        stock_qty = inventory_map.get((salon_product.product_id, salon_product.brand_id), 0)
        payload.append(
            {
                "salon_product_id": str(salon_product.id),
                "product_name": product_name,
                "price": salon_product.price,
                "product_id": salon_product.product_id,
                "brand_id": salon_product.brand_id,
                "brand_name": brand_name,
                "stock_quantity": stock_qty,
            }
        )

    return success_response("Salon products retrieved successfully", data=payload)


@router.get("/staff")
async def list_staff_users(
    current_user: User = Depends(PermissionChecker("appointments.view")),
):
    query = {
        "role": {"$in": ["salon_manager", "employee"]},
        "is_active": True,
        "is_deleted": False,
    }
    effective_tenant_id = _effective_tenant_id(current_user)
    if effective_tenant_id:
        query["tenant_id"] = effective_tenant_id
    staff = await User.find(query).sort("first_name").to_list()
    return success_response(
        "Staff retrieved successfully",
        data=[
            {
                "id": str(user.id),
                "name": user_display_name(user),
                "role": user.role,
            }
            for user in staff
        ],
    )


QUEUE_ACTIVE_STATUSES = {"BOOKED", "CHECKED_IN", "IN_PROGRESS"}
QUEUE_ALL_STATUSES = QUEUE_ACTIVE_STATUSES | {"COMPLETED", "CANCELLED", "NO_SHOW"}


@router.get("/frontdesk/today")
async def get_frontdesk_today(
    salon_id: str,
    status_filter: Optional[str] = Query(default=None),
    include_completed: bool = Query(default=False, description="Include COMPLETED and CANCELLED appointments"),
    current_user: User = Depends(PermissionChecker("appointments.view")),
):
    """
    Returns today's appointment queue for a salon.
    By default only returns active queue items (BOOKED, CHECKED_IN, IN_PROGRESS).
    Pass include_completed=true to also show COMPLETED/CANCELLED appointments.
    """
    now = datetime.now().astimezone()
    start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_dt = start_dt + timedelta(days=1)
    appointments = await appointment_repo.get_branch_calendar(
        salon_id=salon_id,
        start_range=start_dt,
        end_range=end_dt,
    )

    if status_filter:
        appointments = [
            item for item in appointments if item.status == status_filter.upper()
        ]
    elif not include_completed:
        appointments = [
            item for item in appointments if item.status in QUEUE_ACTIVE_STATUSES
        ]

    # Sort by start_datetime ascending for proper queue ordering
    appointments.sort(key=lambda a: a.start_datetime)

    return success_response(
        "Appointments retrieved successfully",
        data=[await _appointment_response(item) for item in appointments],
    )


@router.post("/frontdesk", status_code=status.HTTP_201_CREATED)
async def create_frontdesk_booking(
    payload: FrontDeskAppointmentCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(PermissionChecker("appointments.create")),
):
    appt = await appointment_service.create_frontdesk_appointment(
        salon_id=payload.salon_id,
        customer_id=payload.customer_id,
        start_datetime=payload.start_datetime,
        services=[item.model_dump() for item in payload.services],
        products=[item.model_dump() for item in payload.products],
        payment_type=payload.payment_type,
        payment_status=payload.payment_status,
        paid_amount=payload.paid_amount,
        total_amount=payload.total_amount,
        notes=payload.notes,
        booking_source=payload.booking_source,
        appointment_id=payload.appointment_id,
    )
    await manager.broadcast_to_salon(
        tenant_id=_effective_tenant_id(current_user),
        salon_id=payload.salon_id,
        message={
            "event": "BOOKING_CREATED",
            "salon_id": payload.salon_id,
            "appointment_id": str(appt.id),
            "start_time": appt.start_datetime.isoformat(),
            "staff_id": appt.staff_id,
        },
    )
    recipients = await notification_service._tenant_users_for_roles(
        _effective_tenant_id(current_user),
        payload.salon_id,
        ["salon_owner", "salon_admin", "salon_manager"],
    )
    await notification_service.create_event_notifications(
        tenant_id=_effective_tenant_id(current_user),
        salon_id=payload.salon_id,
        recipients=recipients,
        title="New appointment created",
        body="A new front desk appointment has been created.",
        category="APPOINTMENT",
        notification_type="APPOINTMENT_CREATED",
        source_event="APPOINTMENT_CREATED",
        metadata={"appointment_id": str(appt.id)},
    )
    # Always send WhatsApp message immediately on POS submission
    background_tasks.add_task(whatsapp_service.send_on_appointment_submit, str(appt.id))
    return success_response("Appointment created successfully", data=await _appointment_response(appt), status_code=201)



@router.post("/quick", status_code=status.HTTP_201_CREATED)
async def create_quick_appointment(
    payload: QuickAppointmentCreate,
    current_user: User = Depends(get_current_user),
):
    """
    Creates a quick appointment register entry for upcoming customer appointments.
    Restricted to Super Admin, Salon Owner, and Salon Manager roles.
    Auto-links or creates Customer by mobile number.
    """
    from app.auth.rbac_config import ROLE_SUPER_ADMIN, ROLE_SALON_OWNER, ROLE_SALON_MANAGER, normalize_role
    
    role = normalize_role(current_user.role)
    if role not in {ROLE_SUPER_ADMIN, ROLE_SALON_OWNER, ROLE_SALON_MANAGER, "admin"}:
        raise PermissionDeniedException("Only Super Admin, Salon Owner, and Manager can create appointments.")
        
    phone, phone_err = _normalize_client_phone(payload.phone)
    if phone_err:
        return error_response(phone_err, status_code=400)
        
    effective_tenant = _effective_tenant_id(current_user)
    
    # Lookup or create customer
    customer = await find_client_by_phone(phone, effective_tenant)
    if not customer:
        name_parts = payload.customer_name.strip().split(" ", 1)
        first_name = name_parts[0]
        last_name = name_parts[1] if len(name_parts) > 1 else ""
        customer = Customer(
            tenant_id=effective_tenant,
            first_name=first_name,
            last_name=last_name,
            phone=phone,
            is_member=False,
            notes="Auto-created via quick appointment"
        )
        await customer.insert()
    else:
        # Update customer_name if necessary
        full_existing = customer.full_name.strip()
        if not full_existing or full_existing.lower() == "unknown":
            name_parts = payload.customer_name.strip().split(" ", 1)
            customer.first_name = name_parts[0]
            customer.last_name = name_parts[1] if len(name_parts) > 1 else ""
            await customer.save()

    # Parse date and time
    try:
        dt_str = f"{payload.appointment_date} {payload.appointment_time}"
        naive_dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
        start_dt = make_aware(naive_dt)
    except Exception:
        return error_response("Invalid appointment_date (YYYY-MM-DD) or appointment_time (HH:MM).", status_code=400)
        
    end_dt = start_dt + timedelta(minutes=30)
    
    appt = Appointment(
        tenant_id=effective_tenant,
        salon_id=payload.salon_id,
        customer_id=str(customer.id),
        customer_name=payload.customer_name.strip(),
        customer_phone=phone,
        appointment_date=payload.appointment_date,
        appointment_time=payload.appointment_time,
        type=payload.type or "Appointment",
        start_datetime=start_dt,
        end_datetime=end_dt,
        status="SCHEDULED",
        booking_source="QUICK_REGISTER",
        notes=payload.notes,
        payment_status="PENDING",
        total_price=0.0,
        paid_amount=0.0
    )
    appt.add_status("SCHEDULED", changed_by=str(current_user.id))
    await appt.insert()
    
    await manager.broadcast_to_salon(
        tenant_id=effective_tenant,
        salon_id=payload.salon_id,
        message={
            "event": "QUICK_APPOINTMENT_CREATED",
            "salon_id": payload.salon_id,
            "appointment_id": str(appt.id),
            "customer_name": appt.customer_name,
            "start_time": appt.start_datetime.isoformat(),
        }
    )
    
    return success_response(
        "Quick appointment recorded successfully",
        data={
            "id": str(appt.id),
            "customer_id": str(customer.id),
            "customer_name": appt.customer_name,
            "customer_phone": appt.customer_phone,
            "appointment_date": appt.appointment_date,
            "appointment_time": appt.appointment_time,
            "type": appt.type,
            "status": appt.status,
            "start_datetime": to_utc_iso(appt.start_datetime),
            "notes": appt.notes
        }
    )


@router.get("/today")
async def get_today_appointments(
    salon_id: str = Query(..., description="Salon Branch ID"),
    search: Optional[str] = Query(default=None, description="Search by name, phone or date"),
    date: Optional[str] = Query(default=None, description="Client local date in YYYY-MM-DD"),
    current_user: User = Depends(get_current_user),
):
    """
    Returns today's active appointments and summary metrics for the salon dashboard register.
    """
    from datetime import timezone
    effective_tenant = _effective_tenant_id(current_user)
    
    if date:
        try:
            parsed_date = datetime.strptime(date, "%Y-%m-%d").date()
            today_str = date
        except ValueError:
            parsed_date = datetime.now(timezone.utc).date()
            today_str = parsed_date.strftime("%Y-%m-%d")
    else:
        parsed_date = datetime.now(timezone.utc).date()
        today_str = parsed_date.strftime("%Y-%m-%d")
        
    today_start = datetime.combine(parsed_date, datetime.min.time()).replace(tzinfo=timezone.utc)
    today_end = datetime.combine(parsed_date, datetime.max.time()).replace(tzinfo=timezone.utc)
    
    base_query: dict = {
        "salon_id": salon_id,
        "is_deleted": False,
        "$or": [
            {"appointment_date": today_str},
            {
                "start_datetime": {
                    "$gte": today_start,
                    "$lte": today_end
                }
            }
        ]
    }
    if effective_tenant:
        base_query["tenant_id"] = effective_tenant
        
    all_today = await Appointment.find(base_query).sort("+start_datetime").to_list()
    
    today_appointments_count = sum(1 for a in all_today if a.type == "Appointment")
    today_walkins_count = sum(1 for a in all_today if a.type == "Walk-in")
    completed_today_count = sum(1 for a in all_today if a.status == "COMPLETED")
    
    now_dt = datetime.utcnow()
    # Fallback if start_datetime happens to be tz-aware
    upcoming_items = [
        a for a in all_today 
        if a.status in {"SCHEDULED", "BOOKED", "CONFIRMED", "CHECKED_IN"} 
        and (a.start_datetime.replace(tzinfo=None) if getattr(a, 'start_datetime', None) else datetime.min) >= now_dt
    ]
    upcoming_appointments_count = len(upcoming_items)
    
    next_upcoming = upcoming_items[0] if upcoming_items else None
    
    active_items = [a for a in all_today if a.status not in {"COMPLETED", "CANCELLED"}]
    
    if search and search.strip():
        term = search.strip().lower()
        active_items = [
            a for a in active_items
            if term in (a.customer_name or "").lower()
            or term in (a.customer_phone or "").lower()
            or term in (a.appointment_date or "").lower()
        ]
        
    res_items = []
    for appt in active_items:
        res_items.append({
            "id": str(appt.id),
            "customer_id": appt.customer_id,
            "customer_name": appt.customer_name or "Unknown Client",
            "customer_phone": appt.customer_phone or "",
            "appointment_date": appt.appointment_date or appt.start_datetime.strftime("%Y-%m-%d"),
            "appointment_time": appt.appointment_time or appt.start_datetime.strftime("%H:%M"),
            "type": appt.type or "Appointment",
            "status": appt.status,
            "start_datetime": to_utc_iso(appt.start_datetime),
            "notes": appt.notes or "",
        })
        
    return success_response(
        "Today's appointments retrieved successfully",
        data={
            "summary": {
                "today_appointments": today_appointments_count,
                "today_walkins": today_walkins_count,
                "upcoming_appointments": upcoming_appointments_count,
                "completed_today": completed_today_count,
                "next_upcoming": {
                    "customer_name": next_upcoming.customer_name,
                    "phone": next_upcoming.customer_phone,
                    "time": next_upcoming.appointment_time or next_upcoming.start_datetime.strftime("%H:%M")
                } if next_upcoming else None
            },
            "items": res_items
        }
    )




@router.put("/{id}", response_model=None)
async def update_frontdesk_booking(
    id: str,
    payload: FrontDeskAppointmentCreate,
    current_user: User = Depends(get_current_user),
):
    """Update full appointment details (services, products, pricing, payment, notes). Restricted to Super Admin and Salon Owner."""
    if not _can_edit_appointment(current_user):
        raise PermissionDeniedException(
            detail="Editing appointments is restricted to salon owners and super admins only"
        )
    appt = await appointment_service.update_frontdesk_appointment(
        appointment_id=id,
        salon_id=payload.salon_id,
        customer_id=payload.customer_id,
        start_datetime=payload.start_datetime,
        services=[item.model_dump() for item in payload.services],
        products=[item.model_dump() for item in payload.products],
        payment_type=payload.payment_type,
        payment_status=payload.payment_status,
        paid_amount=payload.paid_amount,
        total_amount=payload.total_amount,
        notes=payload.notes,
        booking_source=payload.booking_source,
    )
    return success_response("Appointment updated successfully", data=await _appointment_response(appt))


@router.get("/list")
async def list_appointments(
    salon_id: str = Query(..., description="Salon branch ID"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None, description="Search by client name or phone"),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    payment_status: Optional[str] = Query(
        default=None,
        description="Payment status filter: PAID, PENDING, or PARTIALLY_PAID",
    ),
    sort_by: str = Query(default="start_datetime"),
    sort_order: str = Query(default="desc"),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    current_user: User = Depends(PermissionChecker("appointments.view")),
):
    """
    Paginated appointment list for a salon with search, filter, and sort support.

    Each appointment is expanded into staff-wise representation rows
    (services + products grouped by assigned staff) before pagination so
    page boundaries never split a staff group incorrectly.
    """
    date_from_aware = make_aware(date_from) if date_from else None
    date_to_aware = make_aware(date_to) if date_to else None

    appointments = await appointment_repo.list_filtered(
        salon_id=salon_id,
        search=search,
        status=status_filter,
        payment_status=payment_status,
        sort_by=sort_by,
        sort_order=sort_order,
        date_from=date_from_aware,
        date_to=date_to_aware,
    )

    enriched = [await _appointment_response(appt) for appt in appointments]

    # Prefer invoice number as stable bill reference across multi-row expansions.
    bill_refs: dict = {}
    appointment_ids = [item["id"] for item in enriched if item.get("id")]
    if appointment_ids:
        from app.models.billing import Invoice

        invoices = (
            await Invoice.find(
                {
                    "appointment_id": {"$in": appointment_ids},
                    "is_deleted": False,
                }
            )
            .sort("-created_at")
            .to_list()
        )
        for invoice in invoices:
            appt_id = invoice.appointment_id
            if appt_id and appt_id not in bill_refs and invoice.invoice_number:
                bill_refs[appt_id] = invoice.invoice_number

    expanded = expand_appointment_items_to_list_rows(
        enriched,
        bill_reference_by_appointment_id=bill_refs,
    )

    if search and search.strip():
        expanded = [row for row in expanded if row_matches_search(row, search)]

    total = len(expanded)
    skip = (page - 1) * limit
    items = expanded[skip : skip + limit]
    pages = max(1, (total + limit - 1) // limit) if total > 0 else 1

    return success_response(
        "Appointments retrieved successfully",
        data={
            "items": items,
            "total": total,
            "page": page,
            "limit": limit,
            "pages": pages,
        },
    )


@router.post("/", response_model=AppointmentResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    payload: AppointmentCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(PermissionChecker("appointments.create"))
) -> Appointment:
    """
    Creates a new Appointment booking.
    Performs conflict checks and sends live socket updates to the receptionist screen.
    """
    appt = await appointment_service.create_appointment(
        salon_id=payload.salon_id,
        customer_id=payload.customer_id,
        staff_id=payload.staff_id,
        start_datetime=payload.start_datetime,
        service_ids=payload.service_ids,
        notes=payload.notes,
        booking_source=payload.booking_source or "RECEPTIONIST"
    )

    # Broadcast change live to the physical salon location branch
    await manager.broadcast_to_salon(
        tenant_id=_effective_tenant_id(current_user),
        salon_id=payload.salon_id,
        message={
            "event": "BOOKING_CREATED",
            "salon_id": payload.salon_id,
            "appointment_id": str(appt.id),
            "start_time": appt.start_datetime.isoformat(),
            "staff_id": appt.staff_id
        }
    )
    recipients = await notification_service._tenant_users_for_roles(
        _effective_tenant_id(current_user),
        payload.salon_id,
        ["salon_owner", "salon_admin", "salon_manager"],
    )
    await notification_service.create_event_notifications(
        tenant_id=_effective_tenant_id(current_user),
        salon_id=payload.salon_id,
        recipients=recipients,
        title="New appointment created",
        body="A new appointment has been created.",
        category="APPOINTMENT",
        notification_type="APPOINTMENT_CREATED",
        source_event="APPOINTMENT_CREATED",
        metadata={"appointment_id": str(appt.id)},
    )

    # Always trigger WhatsApp notification automatically on appointment creation
    background_tasks.add_task(whatsapp_service.send_on_appointment_submit, str(appt.id))

    return appt


@router.put("/{id}/status", response_model=AppointmentResponse)
async def update_booking_status(
    id: str,
    payload: AppointmentStatusUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
) -> Appointment:
    """
    Changes the status of a booking (e.g. checked-in, cancel, check-out).
    Enforces permissions: cancelling requires 'appointments.cancel'.
    """
    if payload.status == "CANCELLED":
        # Enforce cancellation permissions
        from app.auth.permissions import verify_role_has_permission
        verify_role_has_permission(current_user.role, "appointments.cancel")

    appt = await appointment_service.change_status(
        appointment_id=id,
        new_status=payload.status,
        reason=payload.reason
    )

    # Broadcast state change live
    await manager.broadcast_to_salon(
        tenant_id=_effective_tenant_id(current_user),
        salon_id=appt.salon_id,
        message={
            "event": "BOOKING_STATUS_CHANGED",
            "salon_id": appt.salon_id,
            "appointment_id": str(appt.id),
            "status": appt.status
        }
    )
    event_name = "APPOINTMENT_CANCELLED" if appt.status == "CANCELLED" else "APPOINTMENT_STATUS_CHANGED"
    recipients = await notification_service._tenant_users_for_roles(
        _effective_tenant_id(current_user),
        appt.salon_id,
        ["salon_owner", "salon_admin", "salon_manager"],
    )
    await notification_service.create_event_notifications(
        tenant_id=_effective_tenant_id(current_user),
        salon_id=appt.salon_id,
        recipients=recipients,
        title="Appointment updated",
        body=f"Appointment status changed to {appt.status}.",
        category="APPOINTMENT",
        notification_type=event_name,
        source_event=event_name,
        priority="HIGH" if appt.status == "CANCELLED" else "NORMAL",
        metadata={"appointment_id": str(appt.id), "status": appt.status},
    )

    if appt.status == "COMPLETED":
        background_tasks.add_task(whatsapp_service.send_invoice_review_after_completion, str(appt.id))

    return appt


@router.put("/{id}/payment")
async def update_appointment_payment(
    id: str,
    payload: AppointmentPaymentUpdate,
    current_user: User = Depends(PermissionChecker("appointments.create")),
):
    """
    Update payment status for unpaid or partially paid appointments.

    Allowed: PENDING → PARTIALLY_PAID | PAID, and PARTIALLY_PAID → PAID.
    Syncs appointment, bill, and invoice payment fields.
    """
    appt = await appointment_service.update_payment_status(
        appointment_id=id,
        payment_status=payload.payment_status,
        paid_amount=payload.paid_amount,
        payment_type=payload.payment_type,
    )

    await manager.broadcast_to_salon(
        tenant_id=_effective_tenant_id(current_user),
        salon_id=appt.salon_id,
        message={
            "event": "BOOKING_PAYMENT_UPDATED",
            "salon_id": appt.salon_id,
            "appointment_id": str(appt.id),
            "payment_status": appt.payment_status,
            "paid_amount": appt.paid_amount,
        },
    )

    return success_response(
        "Payment status updated successfully",
        data=await _appointment_response(appt),
    )


@router.get("/calendar", response_model=List[AppointmentResponse])
async def get_salon_calendar(
    salon_id: str,
    start_range: datetime,
    end_range: datetime,
    staff_id: Optional[str] = None,
    current_user: User = Depends(PermissionChecker("appointments.view"))
) -> List[Appointment]:
    """
    Queries calendar schedules within a specified timeframe.
    Fully isolated to the logged-in tenant.
    """
    start_dt = make_aware(start_range)
    end_dt = make_aware(end_range)

    return await appointment_repo.get_branch_calendar(
        salon_id=salon_id,
        start_range=start_dt,
        end_range=end_dt,
        staff_id=staff_id
    )
