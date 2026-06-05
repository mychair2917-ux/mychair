from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from beanie import PydanticObjectId
from app.models.appointment import Appointment, ProductSnapshot, ServiceSnapshot
from app.models.billing import Invoice, Payment
from app.models.product import Product
from app.models.salon import Salon
from app.models.salon_product import SalonProduct
from app.models.salon_service import SalonService
from app.models.staff import Staff, StaffSchedule
from app.models.service import Service
from app.models.customer import Customer
from app.models.user import User
from app.repositories.appointment import AppointmentRepository
from app.services.billing import BillingService
from app.services.bill import BillService
from app.core.exceptions import BookingConflictException, ResourceNotFoundException
from app.core import tenant_context
from app.utils.timezone import make_aware

class AppointmentService:
    def __init__(self) -> None:
        self.appointment_repo = AppointmentRepository()
        self.billing_service = BillingService()
        self.bill_service = BillService()

    async def get_customer_for_history(
        self,
        customer_id: str,
        current_user: User,
        salon_id: Optional[str] = None,
    ) -> Customer:
        try:
            customer_object_id = PydanticObjectId(customer_id)
        except Exception as exc:
            raise ResourceNotFoundException("Customer not found") from exc

        query: Dict[str, Any] = {
            "_id": customer_object_id,
            "is_deleted": False,
        }

        if current_user.role == "super_admin":
            tenant_id = tenant_context.get_tenant_id()
            if tenant_id and tenant_id != "system":
                query["tenant_id"] = tenant_id
            elif salon_id:
                query["tenant_id"] = salon_id
        else:
            tenant_id = str(current_user.tenant_id or "").strip()
            if tenant_id:
                query["tenant_id"] = tenant_id

        customer = await Customer.find_one(query)
        if not customer:
            raise ResourceNotFoundException("Customer not found")

        return customer

    async def build_history_response(
        self,
        appointment: Appointment,
        customer: Optional[Customer] = None,
    ) -> Dict[str, Any]:
        customer = customer or await Customer.find_one(
            Customer.id == PydanticObjectId(appointment.customer_id),
            Customer.is_deleted == False,
        )
        staff = await User.find_one(User.id == appointment.staff_id, User.is_deleted == False)
        staff_name = None
        if staff:
            staff_name = " ".join(part for part in [staff.first_name, staff.last_name] if part).strip()
            staff_name = staff_name or staff.email

        invoice: Optional[Invoice] = await self.appointment_repo.get_appointment_invoice(str(appointment.id))
        payments: List[Payment] = []
        if invoice:
            payments = await self.appointment_repo.get_invoice_payments(str(invoice.id))

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
            "products": [
                {
                    "product_id": product.product_id,
                    "name": product.name,
                    "price": product.price,
                    "tax_rate": product.tax_rate,
                    "staff_id": product.staff_id,
                    "staff_name": product.staff_name,
                }
                for product in appointment.products
            ],
            "billing_details": {
                "invoice_id": str(invoice.id) if invoice else None,
                "invoice_number": invoice.invoice_number if invoice else None,
                "invoice_status": invoice.status if invoice else None,
                "subtotal": invoice.subtotal if invoice else appointment.total_price,
                "tax_amount": invoice.tax_amount if invoice else 0.0,
                "discount_amount": invoice.discount_amount if invoice else 0.0,
                "total_amount": invoice.total_amount if invoice else appointment.total_price,
                "amount_paid": invoice.amount_paid if invoice else appointment.paid_amount,
                "payments": [
                    {
                        "id": str(payment.id),
                        "amount": payment.amount,
                        "payment_method": payment.payment_method,
                        "status": payment.status,
                        "transaction_reference": payment.transaction_reference,
                        "refunded_amount": payment.refunded_amount,
                        "refund_reason": payment.refund_reason,
                        "payment_date": payment.payment_date.isoformat(),
                    }
                    for payment in payments
                ],
            },
            "appointment_timeline": [
                {
                    "status": item.status,
                    "changed_at": item.changed_at.isoformat(),
                    "changed_by": item.changed_by,
                    "reason": item.reason,
                }
                for item in appointment.status_history
            ],
        }

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
        try:
            cust_obj_id = PydanticObjectId(customer_id)
        except Exception as exc:
            raise ResourceNotFoundException("Customer not found") from exc
        customer = await Customer.find_one(Customer.id == cust_obj_id, Customer.is_deleted == False)
        if not customer:
            raise ResourceNotFoundException("Customer not found")
            
        try:
            staff_obj_id = PydanticObjectId(staff_id)
        except Exception as exc:
            raise ResourceNotFoundException("Staff member not found") from exc
        staff = await Staff.find_one(Staff.id == staff_obj_id, Staff.is_deleted == False)
        if not staff:
            raise ResourceNotFoundException("Staff member not found")
            
        # 2. Retrieve services, compute total duration and snapshot prices
        total_duration = 0
        total_price = 0.0
        service_snapshots: List[ServiceSnapshot] = []
        
        for s_id in service_ids:
            try:
                svc_obj_id = PydanticObjectId(s_id)
            except Exception as exc:
                raise ResourceNotFoundException(f"Service ID '{s_id}' not found") from exc
            svc = await Service.find_one(Service.id == svc_obj_id, Service.is_deleted == False)
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
        products: List[dict],
        payment_type: str,
        payment_status: str,
        paid_amount: Optional[float],
        total_amount: float,
        notes: Optional[str] = None,
        booking_source: str = "WALK_IN",
    ) -> Appointment:
        """
        Creates a receptionist/POS appointment with per-service staff assignments.
        This keeps the flow fast for walk-ins while still snapshotting services.
        """
        start_dt = make_aware(start_datetime)
        try:
            cust_obj_id = PydanticObjectId(customer_id)
        except Exception as exc:
            raise ResourceNotFoundException("Customer not found") from exc
        customer = await Customer.find_one(Customer.id == cust_obj_id, Customer.is_deleted == False)
        if not customer:
            raise ResourceNotFoundException("Customer not found")

        total_duration = 0
        service_snapshots: List[ServiceSnapshot] = []
        product_snapshots: List[ProductSnapshot] = []
        primary_row = (services or products)
        appointment_staff_id = primary_row[0]["staff_id"]

        for item in services:
            service_id = item.get("service_id")
            salon_service_id = item.get("salon_service_id")
            snapshot_price = item.get("price", 0)
            custom_service_name: Optional[str] = None

            if not service_id and salon_service_id:
                try:
                    salon_service_obj_id = PydanticObjectId(salon_service_id)
                except Exception as exc:
                    raise ResourceNotFoundException(
                        f"Salon service ID '{salon_service_id}' not found"
                    ) from exc
                salon_service = await SalonService.find_one(
                    SalonService.id == salon_service_obj_id,
                    SalonService.salon_id == salon_id,
                    SalonService.is_deleted == False,
                )
                if not salon_service:
                    raise ResourceNotFoundException(
                        f"Salon service ID '{salon_service_id}' not found"
                    )
                if salon_service.service_id:
                    service_id = salon_service.service_id
                else:
                    custom_service_name = (salon_service.custom_service_name or "").strip() or "Custom Service"
                snapshot_price = item.get("price", salon_service.price)

            svc = None
            if service_id:
                try:
                    svc_obj_id = PydanticObjectId(service_id)
                except Exception as exc:
                    raise ResourceNotFoundException(f"Service ID '{service_id}' not found") from exc
                svc = await Service.find_one(Service.id == svc_obj_id, Service.is_deleted == False)
            if not svc and not custom_service_name:
                missing_id = service_id or salon_service_id or "unknown"
                raise ResourceNotFoundException(f"Service ID '{missing_id}' not found")

            try:
                staff_obj_id = PydanticObjectId(item["staff_id"])
            except Exception as exc:
                raise ResourceNotFoundException(f"Staff ID '{item['staff_id']}' not found") from exc

            staff_user = await User.find_one(User.id == staff_obj_id, User.is_deleted == False)
            staff_name = None
            if staff_user:
                staff_name = " ".join(
                    part for part in [staff_user.first_name, staff_user.last_name] if part
                ).strip() or staff_user.email
            else:
                staff = await Staff.find_one(Staff.id == staff_obj_id, Staff.is_deleted == False)
                if not staff:
                    raise ResourceNotFoundException(f"Staff ID '{item['staff_id']}' not found")

            duration_minutes = svc.duration_minutes if svc else 30
            tax_rate = svc.tax_rate if svc else 0.0
            service_name = svc.name if svc else custom_service_name or "Custom Service"
            snapshot_service_id = str(svc.id) if svc else (salon_service_id or service_id or "")

            total_duration += duration_minutes
            service_snapshots.append(
                ServiceSnapshot(
                    service_id=snapshot_service_id,
                    name=service_name,
                    price=float(snapshot_price),
                    duration_minutes=duration_minutes,
                    tax_rate=tax_rate,
                    staff_id=item["staff_id"],
                    staff_name=staff_name,
                )
            )

        for item in products:
            product_id = item.get("product_id")
            salon_product_id = item.get("salon_product_id")
            snapshot_price = item.get("price", 0)
            custom_product_name: Optional[str] = None

            if not product_id and salon_product_id:
                try:
                    salon_product_obj_id = PydanticObjectId(salon_product_id)
                except Exception as exc:
                    raise ResourceNotFoundException(
                        f"Salon product ID '{salon_product_id}' not found"
                    ) from exc
                salon_product = await SalonProduct.find_one(
                    SalonProduct.id == salon_product_obj_id,
                    SalonProduct.salon_id == salon_id,
                    SalonProduct.is_deleted == False,
                )
                if not salon_product:
                    raise ResourceNotFoundException(
                        f"Salon product ID '{salon_product_id}' not found"
                    )
                if salon_product.product_id:
                    product_id = salon_product.product_id
                else:
                    custom_product_name = (
                        (salon_product.custom_product_name or "").strip() or "Custom Product"
                    )
                snapshot_price = item.get("price", salon_product.price)

            product = None
            if product_id:
                try:
                    prod_obj_id = PydanticObjectId(product_id)
                except Exception as exc:
                    raise ResourceNotFoundException(f"Product ID '{product_id}' not found") from exc
                product = await Product.find_one(
                    Product.id == prod_obj_id,
                    Product.is_deleted == False,
                )
            if not product and not custom_product_name:
                missing_id = product_id or salon_product_id or "unknown"
                raise ResourceNotFoundException(f"Product ID '{missing_id}' not found")

            try:
                staff_obj_id = PydanticObjectId(item["staff_id"])
            except Exception as exc:
                raise ResourceNotFoundException(f"Staff ID '{item['staff_id']}' not found") from exc

            staff_user = await User.find_one(User.id == staff_obj_id, User.is_deleted == False)
            staff_name = None
            if staff_user:
                staff_name = " ".join(
                    part for part in [staff_user.first_name, staff_user.last_name] if part
                ).strip() or staff_user.email
            else:
                staff = await Staff.find_one(Staff.id == staff_obj_id, Staff.is_deleted == False)
                if not staff:
                    raise ResourceNotFoundException(f"Staff ID '{item['staff_id']}' not found")

            product_name = product.name if product else custom_product_name or "Custom Product"
            snapshot_product_id = str(product.id) if product else (salon_product_id or product_id or "")
            tax_rate = product.tax_rate if product else 0.0
            product_snapshots.append(
                ProductSnapshot(
                    product_id=snapshot_product_id,
                    name=product_name,
                    price=float(snapshot_price),
                    tax_rate=tax_rate,
                    staff_id=item["staff_id"],
                    staff_name=staff_name,
                )
            )

        end_dt = start_dt + timedelta(minutes=total_duration)

        # Compute effective paid amount based on payment status
        if payment_status == "PAID":
            effective_paid = total_amount
        elif payment_status == "PENDING":
            effective_paid = 0.0
        else:  # PARTIALLY_PAID
            effective_paid = float(paid_amount or 0.0)

        appointment_data = {
            "salon_id": salon_id,
            "customer_id": customer_id,
            "staff_id": appointment_staff_id,
            "start_datetime": start_dt,
            "end_datetime": end_dt,
            "services": service_snapshots,
            "products": product_snapshots,
            "total_price": total_amount,
            "status": "BOOKED",
            "booking_source": booking_source,
            "notes": notes,
            "payment_type": payment_type,
            "payment_status": payment_status,
            "paid_amount": effective_paid,
        }

        appointment = await self.appointment_repo.create(appointment_data)
        appointment.add_status("BOOKED", changed_by=tenant_context.get_user_id())
        await appointment.save()

        # Fetch salon details once — used by both Invoice and Bill creation below.
        # Defined outside try blocks so variables are always in scope.
        try:
            salon = await Salon.find_one({"_id": PydanticObjectId(salon_id), "is_deleted": False})
        except Exception:
            salon = None
        salon_name = salon.name if salon else "Salon"
        salon_phone = getattr(salon, "phone", "") or ""
        salon_addr = getattr(salon, "address", {}) or {}
        salon_address_str = (
            ", ".join(str(v) for v in salon_addr.values() if v)
            if isinstance(salon_addr, dict)
            else ""
        )

        # Shared line-item payloads reused by both Invoice and Bill
        service_payload = [
            {
                "service_id": s.service_id,
                "name": s.name,
                "price": s.price,
                "tax_rate": s.tax_rate,
                "staff_id": s.staff_id,
                "staff_name": s.staff_name,
            }
            for s in service_snapshots
        ]
        product_payload = [
            {
                "product_id": p.product_id,
                "name": p.name,
                "price": p.price,
                "tax_rate": p.tax_rate,
                "staff_id": p.staff_id,
                "staff_name": p.staff_name,
            }
            for p in product_snapshots
        ]
        customer_name_str = customer.full_name.strip() if customer.full_name else ""
        customer_phone_str = customer.phone or ""

        # Auto-generate Invoice (financial ledger record)
        try:
            await self.billing_service.create_invoice_from_appointment(
                appointment_id=str(appointment.id),
                salon_id=salon_id,
                salon_name=salon_name,
                salon_phone=salon_phone,
                salon_address=salon_address_str,
                customer_id=customer_id,
                customer_name=customer_name_str,
                customer_phone=customer_phone_str,
                services=service_payload,
                products=product_payload,
                payment_status=payment_status,
                payment_method=payment_type,
                total_amount=total_amount,
                paid_amount=effective_paid,
            )
        except Exception:
            # Invoice creation failure must not block appointment creation
            pass

        # Auto-generate Bill (customer-facing bill stored in bills collection)
        created_invoice_id: Optional[str] = None
        try:
            bill = await self.bill_service.create_bill_from_appointment(
                appointment_id=str(appointment.id),
                salon_id=salon_id,
                salon_name=salon_name,
                salon_phone=salon_phone,
                salon_address=salon_address_str,
                customer_id=customer_id,
                customer_name=customer_name_str,
                customer_phone=customer_phone_str,
                services=service_payload,
                products=product_payload,
                payment_status=payment_status,
                payment_method=payment_type,
                total_amount=total_amount,
                paid_amount=effective_paid,
            )
            if bill:
                created_invoice_id = str(bill.id)
        except Exception:
            # Bill creation failure must not block appointment creation
            pass

        # Award reward points — isolated so any failure never blocks booking
        try:
            effective_tenant_id = str(customer.tenant_id or "").strip() or salon_id
            from app.services.reward import RewardService
            reward_svc = RewardService()
            await reward_svc.award_points_for_invoice(
                customer_id=customer_id,
                invoice_id=created_invoice_id or "",
                bill_amount=float(total_amount or 0),
                tenant_id=effective_tenant_id,
            )
        except Exception:
            pass

        return appointment

    async def change_status(self, appointment_id: str, new_status: str, reason: Optional[str] = None) -> Appointment:
        """Changes the status of an appointment with audited tracking."""
        appointment = await self.appointment_repo.get(appointment_id)
        user_id = tenant_context.get_user_id()
        
        appointment.add_status(new_status, changed_by=user_id, reason=reason)
        await appointment.save()
        return appointment
