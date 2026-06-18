import logging
import re
from typing import Any, Dict, Optional

import httpx
from beanie import PydanticObjectId

from app.core.config import settings
from app.models.appointment import Appointment
from app.models.bill import Bill
from app.models.billing import Invoice
from app.models.customer_reward_transaction import CustomerRewardTransaction
from app.models.notification_communication import CommunicationLog
from app.models.whatsapp_message import WhatsAppMessageLog
from app.services.invoice_pdf import InvoicePDFService
from app.utils.timezone import now_utc

logger = logging.getLogger("whatsapp")


def _normalize_phone(phone: Optional[str]) -> str:
    digits = re.sub(r"\D+", "", phone or "")
    if digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) == 10:
        return f"91{digits}"
    return digits


def _safe_api_response(response: httpx.Response) -> Dict[str, Any]:
    try:
        payload = response.json()
    except ValueError:
        payload = {"raw": response.text}
    return {"status_code": response.status_code, "body": payload}


def _meta_error_summary(api_response: Dict[str, Any]) -> str:
    body = api_response.get("body") or {}
    error = body.get("error") if isinstance(body, dict) else None
    if not isinstance(error, dict):
        return f"HTTP {api_response.get('status_code')}"

    parts = [
        f"HTTP {api_response.get('status_code')}",
        f"type={error.get('type')}",
        f"code={error.get('code')}",
        f"subcode={error.get('error_subcode')}",
        f"message={error.get('message')}",
        f"trace_id={error.get('fbtrace_id')}",
    ]
    return "; ".join(part for part in parts if not part.endswith("=None"))


class WhatsAppService:
    """WhatsApp Cloud API service — appointment notifications use approved templates."""

    def __init__(self) -> None:
        self.pdf_service = InvoicePDFService()

    def is_configured(self) -> bool:
        return bool(settings.WHATSAPP_PHONE_NUMBER_ID and settings.whatsapp_bearer_token)

    async def latest_status_for_bill(self, bill_id: str) -> str:
        log = await WhatsAppMessageLog.find(
            {"bill_id": bill_id, "message_type": "INVOICE_REVIEW", "is_deleted": False}
        ).sort("-created_at").first_or_none()
        return self._public_status(log)

    async def latest_status_for_invoice(self, invoice_id: str) -> str:
        log = await WhatsAppMessageLog.find(
            {"invoice_id": invoice_id, "message_type": "INVOICE_REVIEW", "is_deleted": False}
        ).sort("-created_at").first_or_none()
        return self._public_status(log)

    async def latest_status_for_appointment(self, appointment_id: str) -> str:
        log = await WhatsAppMessageLog.find(
            {"appointment_id": appointment_id, "message_type": "INVOICE_REVIEW", "is_deleted": False}
        ).sort("-created_at").first_or_none()
        return self._public_status(log)

    def _public_status(self, log: Optional[WhatsAppMessageLog]) -> str:
        if not log:
            return "pending"
        return log.delivery_status or log.message_status

    async def send_invoice_review_after_completion(self, appointment_id: str) -> None:
        await self.send_on_appointment_submit(appointment_id)

    def _resolve_recipient(self, customer_phone: Optional[str]) -> tuple[str, str, bool]:
        original = customer_phone or ""
        test_override_used = bool(settings.WHATSAPP_TEST_RECIPIENT_PHONE)
        resolved = _normalize_phone(
            settings.WHATSAPP_TEST_RECIPIENT_PHONE or original
        )
        return original, resolved, test_override_used

    async def send_on_appointment_submit(self, appointment_id: str) -> None:
        """Send appointment notification via Meta-approved template (not free-form text)."""
        # Temporary testing mode. Using Meta hello_world template until appointment_confirmation template is approved.
        log: Optional[WhatsAppMessageLog] = None
        try:
            appointment = await self._get_appointment(appointment_id)
            if not appointment:
                logger.warning("Appointment %s not found for WhatsApp send", appointment_id)
                return

            existing_log = await WhatsAppMessageLog.find(
                {
                    "appointment_id": appointment_id,
                    "message_type": "INVOICE_REVIEW",
                    "message_status": {"$in": ["pending", "sent"]},
                    "is_deleted": False,
                }
            ).sort("-created_at").first_or_none()
            if existing_log:
                return

            # Retrieve customer phone from Customer model
            from app.models.customer import Customer
            customer = await Customer.find_one(
                {"_id": PydanticObjectId(appointment.customer_id), "is_deleted": False}
            )
            customer_phone = customer.phone if customer else ""

            original_phone, recipient_phone, test_override_used = self._resolve_recipient(
                customer_phone
            )

            logger.info(
                "WhatsApp recipient resolved appointment=%s original_customer_phone=%s "
                "final_recipient_phone=%s test_override_used=%s",
                appointment_id,
                original_phone,
                recipient_phone,
                test_override_used,
            )

            # We fetch invoice and bill if they exist, but do not block if they don't.
            invoice = await Invoice.find_one(
                {"appointment_id": appointment_id, "is_deleted": False}
            )
            bill = await Bill.find_one({"appointment_id": appointment_id, "is_deleted": False})

            log = WhatsAppMessageLog(
                tenant_id=appointment.tenant_id,
                salon_id=appointment.salon_id,
                appointment_id=appointment_id,
                invoice_id=str(invoice.id) if invoice else None,
                bill_id=str(bill.id) if bill else None,
                customer_id=appointment.customer_id,
                phone_number=recipient_phone,
                original_customer_phone=original_phone,
                test_override_used=test_override_used,
                message_status="pending",
                invoice_url=None,  # Do not send invoice links, bill details, review links, or custom text.
                reward_points=0,   # Do not send customer-specific content yet.
            )
            await log.insert()

            if not recipient_phone:
                await self._mark_failed(log, "WhatsApp recipient phone number is missing")
                return
            if not self.is_configured():
                await self._mark_failed(
                    log,
                    "WhatsApp Cloud API is not configured (set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_TOKEN)",
                )
                return

            # Temporary testing mode. Using Meta hello_world template until appointment_confirmation template is approved.
            template_name = settings.WHATSAPP_APPOINTMENT_TEMPLATE or "hello_world"
            payload = self._build_template_payload(recipient_phone, template_name)
            log.message_payload = payload

            api_response = await self._post_to_meta(payload, recipient_phone)
            wamid = self._extract_wamid(api_response)

            if 200 <= api_response["status_code"] < 300:
                log.message_status = "sent"
                log.delivery_status = "sent"
                log.wamid = wamid
                log.sent_at = now_utc()
                log.api_response = api_response
                await log.save()
                logger.info(
                    "WhatsApp template sent appointment=%s recipient=%s wamid=%s template=%s",
                    appointment_id,
                    recipient_phone,
                    wamid,
                    template_name,
                )
                return

            error_summary = _meta_error_summary(api_response)
            logger.error(
                "WhatsApp API error appointment=%s recipient=%s: %s response=%s",
                appointment_id,
                recipient_phone,
                error_summary,
                api_response,
            )
            await self._mark_failed(
                log,
                f"WhatsApp Cloud API returned an error: {error_summary}",
                api_response,
            )
        except Exception as exc:
            logger.exception("WhatsApp send failed for appointment %s: %s", appointment_id, exc)
            if log:
                await self._mark_failed(log, str(exc))

    async def process_status_webhook(self, payload: Dict[str, Any]) -> int:
        """Update whatsapp_message_logs from Meta status callbacks."""
        updated = 0
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {})
                for status_item in value.get("statuses", []):
                    wamid = status_item.get("id")
                    status_value = status_item.get("status")
                    if not wamid or not status_value:
                        continue

                    log = await WhatsAppMessageLog.find_one(
                        {"wamid": wamid, "is_deleted": False}
                    )
                    if not log:
                        campaign_log = await CommunicationLog.find_one(
                            {"provider_message_id": wamid, "channel": "WHATSAPP", "is_deleted": False}
                        )
                        if campaign_log:
                            await self._update_campaign_whatsapp_log(campaign_log, status_value, status_item)
                            updated += 1
                            continue
                        logger.warning("No log found for wamid=%s status=%s", wamid, status_value)
                        continue

                    now = now_utc()
                    log.delivery_status = status_value
                    if status_value == "sent" and not log.sent_at:
                        log.sent_at = now
                        log.message_status = "sent"
                    elif status_value == "delivered":
                        log.delivered_at = now
                        log.message_status = "sent"
                    elif status_value == "read":
                        log.read_at = now
                        log.message_status = "sent"
                    elif status_value == "failed":
                        log.failed_at = now
                        log.message_status = "failed"
                        errors = status_item.get("errors") or []
                        if errors:
                            log.error_message = str(errors[0])

                    await log.save()
                    updated += 1
                    logger.info(
                        "WhatsApp delivery update wamid=%s status=%s recipient=%s",
                        wamid,
                        status_value,
                        status_item.get("recipient_id"),
                    )
        return updated

    async def _update_campaign_whatsapp_log(
        self,
        log: CommunicationLog,
        status_value: str,
        status_item: Dict[str, Any],
    ) -> None:
        now = now_utc()
        if status_value == "failed":
            log.status = "FAILED"
            log.failed_at = now
            errors = status_item.get("errors") or []
            if errors:
                log.error_message = str(errors[0])
        elif status_value in {"delivered", "read"}:
            log.status = "DELIVERED"
            log.delivered_at = log.delivered_at or now
        elif status_value == "sent":
            log.status = "SENT"
            log.sent_at = log.sent_at or now
        await log.save()

        if log.recipient_id:
            from app.services.notifications import notification_service
            await notification_service._refresh_recipient_status(log.recipient_id)
        if log.campaign_id:
            from app.models.notification_communication import CommunicationCampaign
            campaign = await CommunicationCampaign.get(PydanticObjectId(log.campaign_id))
            if campaign:
                from app.services.notifications import notification_service
                await notification_service._refresh_campaign_totals(campaign, completed=True)

        logger.info(
            "WhatsApp campaign delivery update wamid=%s status=%s recipient=%s",
            log.provider_message_id,
            status_value,
            status_item.get("recipient_id"),
        )

    async def _get_appointment(self, appointment_id: str) -> Optional[Appointment]:
        try:
            object_id = PydanticObjectId(appointment_id)
        except Exception:
            logger.warning("Invalid appointment id for WhatsApp send: %s", appointment_id)
            return None
        return await Appointment.find_one({"_id": object_id, "is_deleted": False})

    async def _log_failed_prerequisite(
        self,
        appointment: Appointment,
        invoice: Optional[Invoice],
        bill: Optional[Bill],
    ) -> None:
        customer_id = bill.customer_id if bill else appointment.customer_id
        phone = _normalize_phone(bill.customer_phone if bill else "")
        log = WhatsAppMessageLog(
            tenant_id=appointment.tenant_id,
            salon_id=appointment.salon_id,
            appointment_id=str(appointment.id),
            invoice_id=str(invoice.id) if invoice else None,
            bill_id=str(bill.id) if bill else None,
            customer_id=customer_id,
            phone_number=phone,
            message_status="failed",
            delivery_status="failed",
            error_message="Invoice and bill must both exist before WhatsApp sending",
        )
        await log.insert()

    async def _resolve_reward_points(self, customer_id: str, bill_id: str, invoice_id: str) -> int:
        for reference_id in (bill_id, invoice_id):
            txn = await CustomerRewardTransaction.find_one(
                {
                    "customer_id": customer_id,
                    "invoice_id": reference_id,
                    "type": "EARNED",
                    "is_deleted": False,
                }
            )
            if txn:
                return int(txn.points or 0)
        return 0

    def _graph_messages_url(self) -> str:
        return (
            f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/"
            f"{settings.WHATSAPP_PHONE_NUMBER_ID}/messages"
        )

    def _build_template_payload(self, recipient_phone: str, template_name: str) -> Dict[str, Any]:
        """Exact payload shape used by Meta API Setup test message."""
        return {
            "messaging_product": "whatsapp",
            "to": recipient_phone,
            "type": "template",
            "template": {
                "name": template_name,
                "language": {"code": "en_US"},
            },
        }

    def _extract_wamid(self, api_response: Dict[str, Any]) -> Optional[str]:
        body = api_response.get("body") or {}
        if not isinstance(body, dict):
            return None
        messages = body.get("messages")
        if not isinstance(messages, list) or not messages:
            return None
        first = messages[0]
        if isinstance(first, dict):
            return first.get("id")
        return None

    async def _post_to_meta(self, payload: Dict[str, Any], recipient_phone: str) -> Dict[str, Any]:
        url = self._graph_messages_url()
        headers = {"Authorization": f"Bearer {settings.whatsapp_bearer_token}"}
        logger.info(
            "[WA] Meta request recipient=%s payload=%s",
            recipient_phone,
            payload,
        )
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(url, json=payload, headers=headers)
        except httpx.HTTPError:
            logger.exception("WhatsApp Cloud API request failed before receiving a response")
            raise

        api_response = _safe_api_response(response)
        wamid = self._extract_wamid(api_response)
        logger.info(
            "[WA] Meta response status=%s wamid=%s body=%s",
            api_response.get("status_code"),
            wamid,
            api_response.get("body"),
        )
        if response.status_code >= 400:
            logger.error("WhatsApp Cloud API failed: %s", _meta_error_summary(api_response))
        return api_response

    async def _mark_failed(
        self,
        log: WhatsAppMessageLog,
        error_message: str,
        api_response: Optional[Dict[str, Any]] = None,
    ) -> None:
        log.message_status = "failed"
        log.delivery_status = "failed"
        log.error_message = error_message
        if api_response is not None:
            log.api_response = api_response
        await log.save()
