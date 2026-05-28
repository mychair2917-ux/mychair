from fastapi import APIRouter, Depends, Query, status
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from app.api.dependencies.auth import PermissionChecker, get_current_user
from app.core.exceptions import ResourceNotFoundException
from app.models.customer import Customer
from app.models.service import Service
from app.models.user import User
from app.models.appointment import Appointment
from app.schemas.appointment import (
    AppointmentCreate,
    AppointmentStatusUpdate,
    AppointmentResponse,
    CustomerQuickCreate,
    FrontDeskAppointmentCreate,
)
from app.services.appointment import AppointmentService
from app.repositories.appointment import AppointmentRepository
from app.services.websocket import manager
from app.utils.timezone import make_aware
from app.utils.api_response import success_response

router = APIRouter()
appointment_service = AppointmentService()
appointment_repo = AppointmentRepository()


def _customer_response(customer: Customer) -> dict:
    return {
        "id": str(customer.id),
        "name": customer.full_name.strip(),
        "phone": customer.phone,
        "email": customer.email,
    }


async def _appointment_response(appointment: Appointment) -> dict:
    customer = await Customer.find_one(
        Customer.id == appointment.customer_id, Customer.is_deleted == False
    )
    staff = await User.find_one(User.id == appointment.staff_id, User.is_deleted == False)
    staff_name = None
    if staff:
        staff_name = " ".join(part for part in [staff.first_name, staff.last_name] if part).strip()
        staff_name = staff_name or staff.email

    return {
        "id": str(appointment.id),
        "salon_id": appointment.salon_id,
        "customer_id": appointment.customer_id,
        "customer_name": customer.full_name.strip() if customer else "Unknown client",
        "customer_phone": customer.phone if customer else "",
        "staff_id": appointment.staff_id,
        "staff_name": staff_name,
        "start_datetime": appointment.start_datetime.isoformat(),
        "end_datetime": appointment.end_datetime.isoformat(),
        "total_price": appointment.total_price,
        "status": appointment.status,
        "notes": appointment.notes,
        "booking_source": appointment.booking_source,
        "payment_type": appointment.payment_type,
        "paid_amount": appointment.paid_amount,
        "services": [
            {
                "service_id": service.service_id,
                "name": service.name,
                "price": service.price,
                "duration_minutes": service.duration_minutes,
                "tax_rate": service.tax_rate,
                "staff_id": service.staff_id,
                "staff_name": service.staff_name,
            }
            for service in appointment.services
        ],
    }


@router.get("/clients")
async def search_clients(
    search: str = Query(default="", min_length=1),
    current_user: User = Depends(PermissionChecker("appointments.view")),
):
    term = search.strip()
    query = {
        "$or": [
            {"phone": {"$regex": term, "$options": "i"}},
            {"first_name": {"$regex": term, "$options": "i"}},
            {"last_name": {"$regex": term, "$options": "i"}},
            {"email": {"$regex": term, "$options": "i"}},
        ],
        "is_deleted": False,
    }
    if current_user.tenant_id:
        query["tenant_id"] = current_user.tenant_id
    customers = await Customer.find(query).limit(8).to_list()
    return success_response("Clients retrieved successfully", data=[_customer_response(c) for c in customers])


@router.post("/clients", status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: CustomerQuickCreate,
    current_user: User = Depends(PermissionChecker("appointments.create")),
):
    name_parts = payload.name.strip().split(maxsplit=1)
    customer = Customer(
        first_name=name_parts[0],
        last_name=name_parts[1] if len(name_parts) > 1 else "",
        phone=payload.phone.strip(),
        email=payload.email.strip() if payload.email else None,
        tenant_id=current_user.tenant_id,
    )
    await customer.insert()
    return success_response("Client created successfully", data=_customer_response(customer), status_code=201)


@router.get("/clients/{customer_id}/history")
async def get_client_history(
    customer_id: str,
    current_user: User = Depends(PermissionChecker("appointments.view")),
):
    customer = await Customer.find_one(Customer.id == customer_id, Customer.is_deleted == False)
    if not customer:
        raise ResourceNotFoundException("Customer not found")
    history = await appointment_repo.get_customer_history(customer_id, limit=20)
    return success_response(
        "Client history retrieved successfully",
        data=[await _appointment_response(item) for item in history],
    )


@router.get("/services")
async def list_services(
    current_user: User = Depends(PermissionChecker("appointments.view")),
):
    query = {"is_deleted": False, "is_active": True}
    if current_user.tenant_id:
        query["tenant_id"] = current_user.tenant_id
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


@router.get("/staff")
async def list_staff_users(
    current_user: User = Depends(PermissionChecker("appointments.view")),
):
    query = {
        "role": {"$in": ["salon_manager", "employee"]},
        "is_active": True,
        "is_deleted": False,
    }
    if current_user.tenant_id:
        query["tenant_id"] = current_user.tenant_id
    staff = await User.find(query).sort("first_name").to_list()
    return success_response(
        "Staff retrieved successfully",
        data=[
            {
                "id": str(user.id),
                "name": " ".join(part for part in [user.first_name, user.last_name] if part).strip()
                or user.email,
                "role": user.role,
            }
            for user in staff
        ],
    )


@router.get("/frontdesk/today")
async def get_frontdesk_today(
    salon_id: str,
    status_filter: Optional[str] = Query(default=None),
    current_user: User = Depends(PermissionChecker("appointments.view")),
):
    now = datetime.now().astimezone()
    start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_dt = start_dt + timedelta(days=1)
    appointments = await appointment_repo.get_branch_calendar(
        salon_id=salon_id,
        start_range=start_dt,
        end_range=end_dt,
    )
    if status_filter:
        appointments = [item for item in appointments if item.status == status_filter.upper()]
    return success_response(
        "Appointments retrieved successfully",
        data=[await _appointment_response(item) for item in appointments],
    )


@router.post("/frontdesk", status_code=status.HTTP_201_CREATED)
async def create_frontdesk_booking(
    payload: FrontDeskAppointmentCreate,
    current_user: User = Depends(PermissionChecker("appointments.create")),
):
    appt = await appointment_service.create_frontdesk_appointment(
        salon_id=payload.salon_id,
        customer_id=payload.customer_id,
        start_datetime=payload.start_datetime,
        services=[item.model_dump() for item in payload.services],
        payment_type=payload.payment_type,
        total_amount=payload.total_amount,
        notes=payload.notes,
        booking_source=payload.booking_source,
    )
    await manager.broadcast_to_salon(
        tenant_id=current_user.tenant_id,
        salon_id=payload.salon_id,
        message={
            "event": "BOOKING_CREATED",
            "salon_id": payload.salon_id,
            "appointment_id": str(appt.id),
            "start_time": appt.start_datetime.isoformat(),
            "staff_id": appt.staff_id,
        },
    )
    return success_response("Appointment created successfully", data=await _appointment_response(appt), status_code=201)

@router.get("/list")
async def list_appointments(
    salon_id: str = Query(..., description="Salon branch ID"),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    search: Optional[str] = Query(default=None, description="Search by client name or phone"),
    status_filter: Optional[str] = Query(default=None, alias="status"),
    sort_by: str = Query(default="start_datetime"),
    sort_order: str = Query(default="desc"),
    date_from: Optional[datetime] = Query(default=None),
    date_to: Optional[datetime] = Query(default=None),
    current_user: User = Depends(PermissionChecker("appointments.view")),
):
    """
    Paginated appointment list for a salon with search, filter, and sort support.
    """
    date_from_aware = make_aware(date_from) if date_from else None
    date_to_aware = make_aware(date_to) if date_to else None

    appointments, total = await appointment_repo.list_paginated(
        salon_id=salon_id,
        page=page,
        limit=limit,
        search=search,
        status=status_filter,
        sort_by=sort_by,
        sort_order=sort_order,
        date_from=date_from_aware,
        date_to=date_to_aware,
    )

    # Build enriched response items
    items = []
    for appt in appointments:
        item = await _appointment_response(appt)

        # Apply search filter in-memory (customer name/phone — indexed at query level in future)
        if search and search.strip():
            term = search.strip().lower()
            if (
                term not in item.get("customer_name", "").lower()
                and term not in item.get("customer_phone", "")
                and term not in item.get("id", "").lower()
            ):
                total -= 1
                continue

        items.append(item)

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
        tenant_id=current_user.tenant_id,
        salon_id=payload.salon_id,
        message={
            "event": "BOOKING_CREATED",
            "salon_id": payload.salon_id,
            "appointment_id": str(appt.id),
            "start_time": appt.start_datetime.isoformat(),
            "staff_id": appt.staff_id
        }
    )
    
    return appt


@router.put("/{id}/status", response_model=AppointmentResponse)
async def update_booking_status(
    id: str,
    payload: AppointmentStatusUpdate,
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
        tenant_id=current_user.tenant_id,
        salon_id=appt.salon_id,
        message={
            "event": "BOOKING_STATUS_CHANGED",
            "salon_id": appt.salon_id,
            "appointment_id": str(appt.id),
            "status": appt.status
        }
    )
    
    return appt


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
