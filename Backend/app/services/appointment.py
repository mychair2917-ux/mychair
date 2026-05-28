from datetime import datetime, timedelta
from typing import List, Optional
from app.models.appointment import Appointment, ServiceSnapshot
from app.models.staff import Staff, StaffSchedule
from app.models.service import Service
from app.models.customer import Customer
from app.models.user import User
from app.repositories.appointment import AppointmentRepository
from app.core.exceptions import BookingConflictException, ResourceNotFoundException
from app.core import tenant_context
from app.utils.timezone import make_aware

class AppointmentService:
    def __init__(self) -> None:
        self.appointment_repo = AppointmentRepository()

    async def create_appointment(
        self,
        salon_id: str,
        customer_id: str,
        staff_id: str,
        start_datetime: datetime,
        service_ids: List[str],
        notes: Optional[str] = None,
        booking_source: str = "RECEPTIONIST"
    ) -> Appointment:
        """
        Creates a new appointment booking.
        Performs strict schedule bounds checks, break-time checks, and overlapping conflict validation.
        Snapshots service parameters to protect against future alterations.
        """
        # Ensure all times are UTC-aware
        start_dt = make_aware(start_datetime)
        
        # 1. Fetch dependencies and verify existence
        customer = await Customer.find_one(Customer.id == customer_id, Customer.is_deleted == False)
        if not customer:
            raise ResourceNotFoundException("Customer not found")
            
        staff = await Staff.find_one(Staff.id == staff_id, Staff.is_deleted == False)
        if not staff:
            raise ResourceNotFoundException("Staff member not found")
            
        # 2. Retrieve services, compute total duration and snapshot prices
        total_duration = 0
        total_price = 0.0
        service_snapshots: List[ServiceSnapshot] = []
        
        for s_id in service_ids:
            svc = await Service.find_one(Service.id == s_id, Service.is_deleted == False)
            if not svc:
                raise ResourceNotFoundException(f"Service ID '{s_id}' not found")
            
            total_duration += svc.duration_minutes
            total_price += svc.price
            
            service_snapshots.append(
                ServiceSnapshot(
                    service_id=str(svc.id),
                    name=svc.name,
                    price=svc.price,
                    duration_minutes=svc.duration_minutes,
                    tax_rate=svc.tax_rate
                )
            )
            
        end_dt = start_dt + timedelta(minutes=total_duration)
        
        # 3. Verify staff schedule and available hours
        day_of_week = start_dt.weekday()  # Monday = 0, Sunday = 6
        date_str = start_dt.strftime("%Y-%m-%d")
        
        # Look for a specific date schedule first (leaves/holidays or modified hours), otherwise recurring weekday
        schedule = await StaffSchedule.find_one(
            StaffSchedule.staff_id == staff_id,
            StaffSchedule.salon_id == salon_id,
            StaffSchedule.specific_date == date_str,
            StaffSchedule.is_deleted == False
        )
        if not schedule:
            schedule = await StaffSchedule.find_one(
                StaffSchedule.staff_id == staff_id,
                StaffSchedule.salon_id == salon_id,
                StaffSchedule.day_of_week == day_of_week,
                StaffSchedule.specific_date == None,
                StaffSchedule.is_deleted == False
            )
            
        if not schedule or not schedule.is_available:
            raise BookingConflictException("Stylist is not scheduled to work or on leave for this timeframe")
            
        # Convert scheduling bounds for string comparisons
        req_start_time = start_dt.strftime("%H:%M")
        req_end_time = end_dt.strftime("%H:%M")
        
        if req_start_time < schedule.start_time or req_end_time > schedule.end_time:
            raise BookingConflictException(
                f"Requested timeframe {req_start_time}-{req_end_time} is outside staff scheduled hours ({schedule.start_time}-{schedule.end_time})"
            )
            
        # Validate that the requested timeframe does not overlap with any staff break times
        for brk in schedule.breaks:
            brk_start = brk.get("start", "")
            brk_end = brk.get("end", "")
            if brk_start and brk_end:
                # Overlap check: start_A < end_B and end_A > start_B
                if req_start_time < brk_end and req_end_time > brk_start:
                    raise BookingConflictException(f"Stylist is on break during the requested timeframe ({brk_start}-{brk_end})")
                    
        # 4. Check for overlapping active appointments (Concurrency conflict validation)
        overlapping = await self.appointment_repo.find_overlapping_appointment(staff_id, start_dt, end_dt)
        if overlapping:
            raise BookingConflictException("Stylist is already booked during this timeframe")
            
        # 5. Build and save appointment
        appointment_data = {
            "salon_id": salon_id,
            "customer_id": customer_id,
            "staff_id": staff_id,
            "start_datetime": start_dt,
            "end_datetime": end_dt,
            "services": service_snapshots,
            "total_price": total_price,
            "status": "BOOKED",
            "booking_source": booking_source,
            "notes": notes
        }
        
        appointment = await self.appointment_repo.create(appointment_data)
        appointment.add_status("BOOKED", changed_by=tenant_context.get_user_id())
        await appointment.save()
        
        # Trigger background notifications and tasks here (e.g. queue_reminder)
        return appointment

    async def create_frontdesk_appointment(
        self,
        salon_id: str,
        customer_id: str,
        start_datetime: datetime,
        services: List[dict],
        payment_type: str,
        total_amount: float,
        notes: Optional[str] = None,
        booking_source: str = "WALK_IN",
    ) -> Appointment:
        """
        Creates a receptionist/POS appointment with per-service staff assignments.
        This keeps the flow fast for walk-ins while still snapshotting services.
        """
        start_dt = make_aware(start_datetime)
        customer = await Customer.find_one(Customer.id == customer_id, Customer.is_deleted == False)
        if not customer:
            raise ResourceNotFoundException("Customer not found")

        total_duration = 0
        service_snapshots: List[ServiceSnapshot] = []
        appointment_staff_id = services[0]["staff_id"]

        for item in services:
            svc = await Service.find_one(Service.id == item["service_id"], Service.is_deleted == False)
            if not svc:
                raise ResourceNotFoundException(f"Service ID '{item['service_id']}' not found")

            staff_user = await User.find_one(User.id == item["staff_id"], User.is_deleted == False)
            staff_name = None
            if staff_user:
                staff_name = " ".join(
                    part for part in [staff_user.first_name, staff_user.last_name] if part
                ).strip() or staff_user.email
            else:
                staff = await Staff.find_one(Staff.id == item["staff_id"], Staff.is_deleted == False)
                if not staff:
                    raise ResourceNotFoundException(f"Staff ID '{item['staff_id']}' not found")

            total_duration += svc.duration_minutes
            service_snapshots.append(
                ServiceSnapshot(
                    service_id=str(svc.id),
                    name=svc.name,
                    price=item["price"],
                    duration_minutes=svc.duration_minutes,
                    tax_rate=svc.tax_rate,
                    staff_id=item["staff_id"],
                    staff_name=staff_name,
                )
            )

        end_dt = start_dt + timedelta(minutes=total_duration)
        appointment_data = {
            "salon_id": salon_id,
            "customer_id": customer_id,
            "staff_id": appointment_staff_id,
            "start_datetime": start_dt,
            "end_datetime": end_dt,
            "services": service_snapshots,
            "total_price": total_amount,
            "status": "BOOKED",
            "booking_source": booking_source,
            "notes": notes,
            "payment_type": payment_type,
            "paid_amount": total_amount,
        }

        appointment = await self.appointment_repo.create(appointment_data)
        appointment.add_status("BOOKED", changed_by=tenant_context.get_user_id())
        await appointment.save()
        return appointment

    async def change_status(self, appointment_id: str, new_status: str, reason: Optional[str] = None) -> Appointment:
        """Changes the status of an appointment with audited tracking."""
        appointment = await self.appointment_repo.get(appointment_id)
        user_id = tenant_context.get_user_id()
        
        appointment.add_status(new_status, changed_by=user_id, reason=reason)
        await appointment.save()
        return appointment
