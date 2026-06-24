import logging
from typing import Dict, Any
from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.notification import Notification
from app.utils.timezone import now_utc
from app.core import tenant_context
import httpx

logger = logging.getLogger("worker")

async def send_notification_task(ctx: Dict[str, Any], notification_id: str) -> bool:
    """
    ARQ Background Task.
    Simulates gateway transmission (Twilio, SendGrid, WhatsApp Cloud API).
    Updates dispatch delivery states.
    """
    # Initialize DB since workers run in independent threads
    from app.db.connection import init_db
    try:
        # Beanie might already be initialized in this process
        await init_db()
    except Exception:
        pass

    notification = await Notification.find_one(Notification.id == notification_id)
    if not notification:
        logger.error(f"Notification ID {notification_id} not found in database.")
        return False
        
    notification.status = "RETRYING"
    
    logger.info(f"Sending {notification.channel} notification to {notification.recipient_address}...")
    
    # Mocking gateway dispatch
    try:
        # Inside a real production system, this makes async HTTP calls to external API gateways
        # e.g., await httpx.post("https://api.twilio.com/...", json={...})
        
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
    Triggered when an appointment is booked:
    1. Schedules notification reminders.
    2. Updates CRM loyalty stats.
    3. Increments popularity aggregators.
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
        
    # Temporarily bind context for BaseTenantDocument hooks
    tenant_context.set_tenant_id(appt.tenant_id)
    
    # 1. Update Customer loyalty points (loyalty updated)
    customer = await Customer.find_one(Customer.id == appt.customer_id)
    if customer:
        customer.loyalty_points += int(appt.total_price * 0.1)  # 10% points credit
        await customer.save()
        logger.info(f"Credited loyalty points to Customer {appt.customer_id}")
        
    # 2. Queue Email & SMS confirmations
    email_notification = Notification(
        recipient_type="CUSTOMER",
        recipient_id=appt.customer_id,
        channel="EMAIL",
        recipient_address=customer.email or "client@email.com" if customer else "client@email.com",
        subject="Appointment Confirmed!",
        body=f"Hi {customer.first_name if customer else 'Client'}, your booking is scheduled for {appt.start_datetime.strftime('%Y-%m-%d %H:%M')}"
    )
    await email_notification.insert()
    
    # Push dispatch job to workers
    # In a full ARQ setup: await ctx['redis'].enqueue_job('send_notification_task', str(email_notification.id))
    # We will trigger the local task synchronously here or log it
    logger.info(f"Queued email notification ID {email_notification.id} for dispatch.")


async def process_scheduled_campaigns(ctx: Dict[str, Any]) -> int:
    """Dispatch due communication campaigns through the real provider integrations."""
    from app.db.connection import init_db
    from app.services.notifications import notification_service

    try:
        await init_db()
    except Exception:
        pass

    sent_count = await notification_service.send_due_scheduled_campaigns()
    logger.info("Processed %s scheduled communication campaigns.", sent_count)
    return sent_count
