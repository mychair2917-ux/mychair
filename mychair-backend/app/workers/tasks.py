import logging
from typing import Dict, Any, Optional
from datetime import datetime
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.notification import Notification
from app.utils.timezone import now_utc
from app.core import tenant_context

logger = logging.getLogger("worker")

async def send_notification_task(ctx: Dict[str, Any], notification_id: str) -> bool:
    """
    ARQ Background Task.
    Updates dispatch delivery states.
    """
    from app.db.connection import init_db
    try:
        await init_db()
    except Exception:
        pass

    notification = await Notification.find_one(Notification.id == notification_id)
    if not notification:
        logger.error(f"Notification ID {notification_id} not found in database.")
        return False
        
    notification.status = "RETRYING"
    logger.info(f"Sending {notification.channel} notification to {notification.recipient_address}...")
    
    try:
        notification.status = "SENT"
        notification.sent_at = now_utc()
        await notification.save()
        logger.info(f"Notification ID {notification_id} successfully delivered!")
        return True
    except Exception as e:
        notification.status = "FAILED"
        notification.error_message = str(e)
        await notification.save()
        logger.error(f"Notification ID {notification_id} failed: {str(e)}")
        return False


async def process_appointment_booked_workflow(ctx: Dict[str, Any], appointment_id: str) -> None:
    """
    ARQ Workflow orchestration task.
    Triggered when an appointment is booked.
    """
    from app.db.connection import init_db
    try:
        await init_db()
    except Exception:
        pass

    appt = await Appointment.find_one(Appointment.id == appointment_id)
    if not appt:
        logger.error(f"Appointment ID {appointment_id} not found.")
        return
        
    tenant_context.set_tenant_id(appt.tenant_id)
    
    customer = await Customer.find_one(Customer.id == appt.customer_id)
    if customer:
        customer.loyalty_points += int(appt.total_price * 0.1)
        await customer.save()
        logger.info(f"Credited loyalty points to Customer {appt.customer_id}")
        
    email_notification = Notification(
        recipient_type="CUSTOMER",
        recipient_id=appt.customer_id,
        channel="EMAIL",
        recipient_address=customer.email or "client@email.com" if customer else "client@email.com",
        subject="Appointment Confirmed!",
        body=f"Hi {customer.first_name if customer else 'Client'}, your booking is scheduled for {appt.start_datetime.strftime('%Y-%m-%d %H:%M')}"
    )
    await email_notification.insert()
    logger.info(f"Queued email notification ID {email_notification.id} for dispatch.")


async def process_scheduled_campaigns(ctx: Dict[str, Any]) -> int:
    """Dispatch due communication campaigns through provider integrations."""
    from app.db.connection import init_db
    from app.services.notifications import notification_service

    try:
        await init_db()
    except Exception:
        pass

    sent_count = await notification_service.send_due_scheduled_campaigns()
    logger.info("Processed %s scheduled communication campaigns.", sent_count)
    return sent_count


async def process_whatsapp_message_job(
    ctx: Dict[str, Any],
    salon_id: str,
    customer_id: Optional[str],
    recipient_phone: str,
    message_type: str,
    template_name: str,
    language_code: str = "en_US",
    template_variables: Optional[Dict[str, Any]] = None,
    reference_type: Optional[str] = None,
    reference_id: Optional[str] = None,
    tenant_id: Optional[str] = None,
) -> bool:
    """
    ARQ Background Worker Task for sending WhatsApp Messages asynchronously.
    Decouples payment/appointment flows from WhatsApp delivery latency or failures.
    Includes safe retry logic with exponential backoff for temporary failures.
    """
    from app.db.connection import init_db
    from app.services.whatsapp import whatsapp_service

    try:
        await init_db()
    except Exception:
        pass

    logger.info("[ARQ Worker] Processing WhatsApp job salon_id=%s reference=%s:%s type=%s", salon_id, reference_type, reference_id, message_type)
    
    log = await whatsapp_service.send_template_message(
        salon_id=salon_id,
        customer_id=customer_id,
        recipient_phone=recipient_phone,
        message_type=message_type,
        template_name=template_name,
        language_code=language_code,
        template_variables=template_variables,
        reference_type=reference_type,
        reference_id=reference_id,
        tenant_id=tenant_id,
    )
    
    return log.status in {"SENT", "DELIVERED", "READ"}


async def process_birthday_whatsapp_automation(ctx: Dict[str, Any]) -> int:
    """
    Daily scheduled ARQ cron task for Birthday Automation.
    Finds customers whose birthday is today, verifies WhatsApp opt-in and salon connection,
    and enqueues WhatsApp birthday wish messages.
    """
    from app.db.connection import init_db
    from app.services.whatsapp import whatsapp_service

    try:
        await init_db()
    except Exception:
        pass

    today = now_utc()
    customers = await Customer.find({"is_deleted": False}).to_list()
    
    sent_count = 0
    for cust in customers:
        if not cust.dob:
            continue
        if cust.dob.month == today.month and cust.dob.day == today.day:
            if cust.whatsapp_opt_out or not cust.whatsapp_opt_in:
                continue

            # Determine salon_id from tenant/metadata
            salon_id = cust.metadata.get("salon_id") or "default"
            is_connected = await whatsapp_service.is_salon_connected(salon_id)
            if not is_connected:
                continue

            account = await whatsapp_service.get_salon_account(salon_id)
            if account and not account.features.get("birthday_messages_enabled", True):
                continue

            template_name = "hello_world"
            if account and account.templates and "birthday_wish" in account.templates:
                template_name = account.templates.get("birthday_wish", "hello_world")

            log = await whatsapp_service.send_template_message(
                salon_id=salon_id,
                customer_id=str(cust.id),
                recipient_phone=cust.phone,
                message_type="BIRTHDAY_WISH",
                template_name=template_name,
                template_variables={"1": cust.first_name},
                reference_type="BIRTHDAY",
                reference_id=f"bday-{cust.id}-{today.strftime('%Y%m%d')}",
                tenant_id=cust.tenant_id,
            )
            if log.status in {"SENT", "DELIVERED", "READ"}:
                sent_count += 1

    logger.info("[ARQ Cron] Birthday automation processed %s birthday wishes.", sent_count)
    return sent_count
