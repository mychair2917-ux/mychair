import logging
from typing import Dict, Any, Optional, Tuple

import httpx

from app.models.appointment import Appointment
from app.models.customer import Customer
from app.models.notification import Notification
from app.utils.timezone import now_utc
from app.core import tenant_context
from app.core.config import settings
from app.services.email_service import send_email

logger = logging.getLogger("worker")


async def _dispatch_email(to_email: str, subject: str, body: str) -> Tuple[bool, Optional[str]]:
    success, error, _message_id = await send_email(
        to_email=to_email,
        subject=subject or "MyChair notification",
        html=(body or "").replace("\n", "<br />"),
    )
    return success, error


async def _dispatch_whatsapp(phone: str, body: str) -> Tuple[bool, Optional[str]]:
    if not settings.WHATSAPP_PHONE_NUMBER_ID or not settings.whatsapp_bearer_token:
        return False, "WhatsApp Cloud API is not configured."
    payload = {
        "messaging_product": "whatsapp",
        "to": phone,
        "type": "text",
        "text": {"body": body or ""},
    }
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/{settings.WHATSAPP_PHONE_NUMBER_ID}/messages",
                headers={
                    "Authorization": f"Bearer {settings.whatsapp_bearer_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            if 200 <= response.status_code < 300:
                return True, None
            return False, response.text
    except Exception as exc:
        return False, f"WhatsApp service unavailable: {exc}"


async def send_notification_task(ctx: Dict[str, Any], notification_id: str) -> bool:
    """
    ARQ Background Task.
    Dispatches via Resend (email) or WhatsApp Cloud API and updates delivery state.
    Never marks SENT unless a provider accepts the message (or channel is IN_APP).
    """
    from app.db.connection import init_db
    try:
        await init_db()
    except Exception:
        pass

    notification = await Notification.find_one(Notification.id == notification_id)
    if not notification:
        logger.error("Notification ID %s not found in database.", notification_id)
        return False

    notification.status = "RETRYING"
    await notification.save()

    channel = (notification.channel or "").upper()
    logger.info(
        "Sending %s notification to %s...",
        channel,
        notification.recipient_address,
    )

    try:
        if channel == "IN_APP":
            success, error = True, None
        elif channel == "EMAIL":
            success, error = await _dispatch_email(
                notification.recipient_address,
                notification.subject or "MyChair notification",
                notification.body or "",
            )
        elif channel in {"WHATSAPP", "SMS"}:
            success, error = await _dispatch_whatsapp(
                notification.recipient_address,
                notification.body or "",
            )
        else:
            success, error = False, f"Unsupported notification channel: {channel}"

        if success:
            notification.status = "SENT"
            notification.sent_at = now_utc()
            notification.error_message = None
            await notification.save()
            logger.info("Notification ID %s successfully delivered.", notification_id)
            return True

        notification.status = "FAILED"
        notification.error_message = error or "Delivery failed"
        await notification.save()
        logger.error("Notification ID %s failed: %s", notification_id, error)
        return False
    except Exception as exc:
        notification.status = "FAILED"
        notification.error_message = str(exc)
        await notification.save()
        logger.error("Notification ID %s failed: %s", notification_id, exc)
        return False


async def process_appointment_booked_workflow(ctx: Dict[str, Any], appointment_id: str) -> None:
    """
    ARQ Workflow orchestration task.
    Triggered when an appointment is booked:
    1. Schedules notification reminders.
    2. Updates CRM loyalty stats.
    """
    from app.db.connection import init_db
    try:
        await init_db()
    except Exception:
        pass

    appt = await Appointment.find_one(Appointment.id == appointment_id)
    if not appt:
        logger.error("Appointment ID %s not found.", appointment_id)
        return

    tenant_context.set_tenant_id(appt.tenant_id)

    customer = await Customer.find_one(Customer.id == appt.customer_id)
    if customer:
        customer.loyalty_points += int(appt.total_price * 0.1)
        await customer.save()
        logger.info("Credited loyalty points to Customer %s", appt.customer_id)

    if not customer or not customer.email:
        logger.info(
            "Skipping email confirmation for appointment %s — no customer email on file.",
            appointment_id,
        )
        return

    email_notification = Notification(
        recipient_type="CUSTOMER",
        recipient_id=appt.customer_id,
        channel="EMAIL",
        recipient_address=customer.email,
        subject="Appointment Confirmed!",
        body=(
            f"Hi {customer.first_name or 'Client'}, your booking is scheduled for "
            f"{appt.start_datetime.strftime('%d/%m/%Y %H:%M')}."
        ),
    )
    await email_notification.insert()

    redis = ctx.get("redis")
    if redis is not None:
        await redis.enqueue_job("send_notification_task", str(email_notification.id))
        logger.info("Queued email notification ID %s for dispatch.", email_notification.id)
    else:
        await send_notification_task(ctx, str(email_notification.id))


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
