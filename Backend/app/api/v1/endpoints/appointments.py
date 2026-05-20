from fastapi import APIRouter, Depends, Query, status
from datetime import datetime
from typing import List, Optional
from app.api.dependencies.auth import PermissionChecker, get_current_user
from app.models.user import User
from app.models.appointment import Appointment
from app.schemas.appointment import AppointmentCreate, AppointmentStatusUpdate, AppointmentResponse
from app.services.appointment import AppointmentService
from app.repositories.appointment import AppointmentRepository
from app.services.websocket import manager
from app.utils.timezone import make_aware

router = APIRouter()
appointment_service = AppointmentService()
appointment_repo = AppointmentRepository()

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
