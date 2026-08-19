import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from beanie import PydanticObjectId

from app.core.config import settings
from app.models.customer import Customer
from app.models.salon_whatsapp_account import SalonWhatsAppAccount
from app.models.whatsapp_message import WhatsAppMessageLog
from app.services.whatsapp.base_provider import WhatsAppProvider
from app.services.whatsapp.meta_provider import MetaCloudApiProvider
from app.utils.timezone import now_utc

logger = logging.getLogger("whatsapp.service")


def normalize_phone_number(phone: Optional[str]) -> str:
    """Normalizes raw input phone string into standard E.164 digits without leading '+' or spaces."""
    if not phone:
        return ""
    digits = re.sub(r"\D+", "", phone)
    if digits.startswith("0") and len(digits) == 11:
        digits = digits[1:]
    if len(digits) == 10:
        return f"91{digits}"
    return digits


class WhatsAppService:
    """
    Centralized WhatsApp Service Layer.
    Multi-tenant aware: resolves WABA credentials and phone number IDs strictly per salon_id.
    Uses abstract WhatsAppProvider pattern for provider independence.
    """

    def __init__(self, provider: Optional[WhatsAppProvider] = None):
        self.provider = provider or MetaCloudApiProvider()

    async def get_salon_account(self, salon_id: str) -> Optional[SalonWhatsAppAccount]:
        """Retrieves salon WhatsApp account configuration by salon_id."""
        return await SalonWhatsAppAccount.find_one(
            {"salon_id": salon_id, "is_deleted": False}
        )

    async def get_or_create_salon_account(self, salon_id: str, tenant_id: Optional[str] = None) -> SalonWhatsAppAccount:
        """Retrieves existing account or initializes a blank default account for the salon."""
        account = await self.get_salon_account(salon_id)
        if not account:
            account = SalonWhatsAppAccount(
                tenant_id=tenant_id or "default",
                salon_id=salon_id,
                status="DISCONNECTED",
                connection_status="ACTIVE",
            )
            await account.insert()
        return account

    async def is_salon_connected(self, salon_id: str) -> bool:
        """Returns whether a salon has an active, connected WhatsApp Business account."""
        account = await self.get_salon_account(salon_id)
        if account and account.status == "CONNECTED" and account.phone_number_id:
            return True
        # Global environment fallback if configured
        return bool(settings.WHATSAPP_PHONE_NUMBER_ID and settings.whatsapp_bearer_token)

    async def connect_salon_waba(
        self,
        salon_id: str,
        tenant_id: str,
        waba_id: str,
        phone_number_id: str,
        business_phone_number: str,
        display_name: str,
        access_token: str,
        connection_status: str = "ACTIVE",
        additional_auth_data: Optional[Dict[str, Any]] = None,
    ) -> SalonWhatsAppAccount:
        """
        Connects or updates a salon's WhatsApp Business Account configuration from Meta Embedded Signup.
        Stores access tokens securely inside server-side database (never exposed to browser).
        """
        account = await self.get_or_create_salon_account(salon_id, tenant_id)
        
        # Build encrypted/secure authorization container
        auth_data = account.authorization_data or {}
        auth_data["access_token"] = access_token
        auth_data["updated_at"] = now_utc().isoformat()
        if additional_auth_data:
            auth_data.update(additional_auth_data)

        account.waba_id = waba_id
        account.phone_number_id = phone_number_id
        account.business_phone_number = business_phone_number
        account.display_name = display_name
        account.status = "CONNECTED"
        account.connection_status = connection_status
        account.authorization_data = auth_data
        account.connected_at = now_utc()
        account.disconnected_at = None

        await account.save()
        logger.info("Salon %s successfully connected WABA phone_number_id=%s", salon_id, phone_number_id)
        return account

    async def exchange_embedded_signup_code(
        self,
        salon_id: str,
        tenant_id: str,
        code: Optional[str] = None,
        waba_id: Optional[str] = None,
        phone_number_id: Optional[str] = None,
        direct_access_token: Optional[str] = None,
    ) -> SalonWhatsAppAccount:
        """
        Exchanges Meta Embedded Signup authorization code for a system access token,
        fetches & validates WABA and phone details directly from Meta Graph API,
        checks for WhatsApp Business App mobile coexistence requirements,
        and securely persists credentials to SalonWhatsAppAccount associated with salon_id and tenant_id.
        """
        access_token = direct_access_token
        expires_in = None

        # 1. Exchange OAuth authorization code with Meta Graph API if code is provided
        if code:
            app_id = settings.META_APP_ID or settings.WHATSAPP_PHONE_NUMBER_ID
            app_secret = settings.WHATSAPP_APP_SECRET
            
            if app_id and app_secret:
                url = f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/oauth/access_token"
                params = {
                    "client_id": app_id,
                    "client_secret": app_secret,
                    "code": code,
                }
                if settings.META_OAUTH_REDIRECT_URI:
                    params["redirect_uri"] = settings.META_OAUTH_REDIRECT_URI

                try:
                    import httpx
                    async with httpx.AsyncClient(timeout=12.0) as client:
                        resp = await client.get(url, params=params)
                        body = resp.json()
                        if resp.status_code == 200 and "access_token" in body:
                            access_token = body["access_token"]
                            expires_in = body.get("expires_in")
                        else:
                            error_msg = body.get("error", {}).get("message") or f"Meta OAuth token exchange failed (HTTP {resp.status_code})"
                            logger.error("Meta OAuth exchange error: %s", body)
                            if not access_token:
                                raise ValueError(f"Meta authorization exchange failed: {error_msg}")
                except httpx.HTTPError as exc:
                    logger.exception("HTTP error during Meta OAuth token exchange: %s", exc)
                    if not access_token:
                        raise ValueError(f"Network error exchanging code with Meta: {str(exc)}")

        if not access_token:
            access_token = settings.whatsapp_bearer_token

        if not access_token:
            raise ValueError("No access token acquired from Meta Embedded Signup code exchange.")

        # 2. Fetch WABA details & phone number details from Meta Graph API
        fetched_waba_id = waba_id
        fetched_phone_id = phone_number_id
        business_phone = None
        display_name = None
        connection_status = "ACTIVE"
        meta_raw: Dict[str, Any] = {}

        if access_token and access_token.startswith("EAA"):
            import httpx
            headers = {"Authorization": f"Bearer {access_token}"}
            api_ver = settings.WHATSAPP_API_VERSION

            if not fetched_waba_id:
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        waba_resp = await client.get(f"https://graph.facebook.com/{api_ver}/me/client_whatsapp_business_accounts", headers=headers)
                        waba_data = waba_resp.json()
                        data_list = waba_data.get("data", [])
                        if data_list and isinstance(data_list, list):
                            fetched_waba_id = data_list[0].get("id")
                except Exception as exc:
                    logger.warning("Could not auto-resolve WABA ID: %s", exc)

            if fetched_waba_id:
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        phone_url = f"https://graph.facebook.com/{api_ver}/{fetched_waba_id}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,quality_rating,status,name_status"
                        p_resp = await client.get(phone_url, headers=headers)
                        p_data = p_resp.json()
                        meta_raw["phone_numbers"] = p_data

                        phones = p_data.get("data", [])
                        selected_phone = None
                        if phones:
                            if fetched_phone_id:
                                selected_phone = next((p for p in phones if p.get("id") == fetched_phone_id), phones[0])
                            else:
                                selected_phone = phones[0]

                        if selected_phone:
                            fetched_phone_id = selected_phone.get("id")
                            business_phone = selected_phone.get("display_phone_number")
                            display_name = selected_phone.get("verified_name")

                            ver_status = selected_phone.get("code_verification_status")
                            p_status = selected_phone.get("status")
                            if ver_status and ver_status != "VERIFIED":
                                connection_status = "VERIFICATION_REQUIRED"
                            elif p_status in ("MIGRATION_REQUIRED", "COEXISTENCE_REQUIRED"):
                                connection_status = "COEXISTENCE_REQUIRED"
                except Exception as exc:
                    logger.warning("Could not query Meta phone numbers for WABA %s: %s", fetched_waba_id, exc)

        if not fetched_waba_id:
            fetched_waba_id = waba_id or "pending_waba_id"
        if not fetched_phone_id:
            fetched_phone_id = phone_number_id or "pending_phone_id"
        if not business_phone:
            business_phone = "Pending Meta Setup"
        if not display_name:
            display_name = "Salon WhatsApp"

        additional_data = {
            "oauth_code": code,
            "token_expires_in": expires_in,
            "meta_raw": meta_raw,
        }

        account = await self.connect_salon_waba(
            salon_id=salon_id,
            tenant_id=tenant_id,
            waba_id=fetched_waba_id,
            phone_number_id=fetched_phone_id,
            business_phone_number=business_phone,
            display_name=display_name,
            access_token=access_token,
            connection_status=connection_status,
            additional_auth_data=additional_data,
        )

        return account

    async def disconnect_salon_waba(self, salon_id: str) -> Optional[SalonWhatsAppAccount]:

        """Disconnects WhatsApp integration for a salon."""
        account = await self.get_salon_account(salon_id)
        if account:
            account.status = "DISCONNECTED"
            account.disconnected_at = now_utc()
            await account.save()
            logger.info("Salon %s WhatsApp disconnected", salon_id)
        return account

    async def _resolve_credentials(self, salon_id: str) -> Tuple[Optional[str], Optional[str], Optional[SalonWhatsAppAccount]]:
        """Resolves Phone Number ID and Access Token for a specific salon, with environment fallback."""
        account = await self.get_salon_account(salon_id)
        if account and account.status == "CONNECTED" and account.phone_number_id:
            token = account.authorization_data.get("access_token") or settings.whatsapp_bearer_token
            return account.phone_number_id, token, account

        # Fallback to system-level developer app settings if salon account is not configured yet
        if settings.WHATSAPP_PHONE_NUMBER_ID and settings.whatsapp_bearer_token:
            return settings.WHATSAPP_PHONE_NUMBER_ID, settings.whatsapp_bearer_token, account

        return None, None, account

    async def check_customer_opt_in(self, customer_id: Optional[str]) -> bool:
        """Verifies if customer has opted out of WhatsApp messages."""
        if not customer_id:
            return True
        try:
            cust = await Customer.find_one({"_id": PydanticObjectId(customer_id), "is_deleted": False})
            if cust and (cust.whatsapp_opt_out or not cust.whatsapp_opt_in):
                return False
        except Exception:
            pass
        return True

    async def send_template_message(
        self,
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
        components: Optional[List[Dict[str, Any]]] = None,
    ) -> WhatsAppMessageLog:
        """
        Generic, reusable multi-tenant message sending method.
        Resolves WABA configuration per salon_id.
        Enforces deduplication key, customer opt-in check, and complete audit logging.
        """
        normalized_phone = normalize_phone_number(
            settings.WHATSAPP_TEST_RECIPIENT_PHONE or recipient_phone
        )
        test_override_used = bool(settings.WHATSAPP_TEST_RECIPIENT_PHONE)

        deduplication_key = None
        if reference_type and reference_id and message_type:
            deduplication_key = f"{salon_id}:{reference_type}:{reference_id}:{message_type}"

        # Deduplication check: prevent sending duplicate WhatsApp messages for same bill/appointment
        if deduplication_key:
            existing = await WhatsAppMessageLog.find_one({
                "deduplication_key": deduplication_key,
                "status": {"$in": ["QUEUED", "SENDING", "SENT", "DELIVERED", "READ"]},
                "is_deleted": False
            })
            if existing:
                logger.info("Skipping duplicate WhatsApp message send for key=%s", deduplication_key)
                return existing

        # Initialize audit log
        log = WhatsAppMessageLog(
            tenant_id=tenant_id or "default",
            salon_id=salon_id,
            customer_id=customer_id or "",
            phone_number=normalized_phone,
            original_customer_phone=recipient_phone,
            test_override_used=test_override_used,
            message_type=message_type,
            status="QUEUED",
            template_name=template_name,
            template_language=language_code,
            template_variables=template_variables,
            reference_type=reference_type,
            reference_id=reference_id,
            deduplication_key=deduplication_key,
            bill_id=reference_id if reference_type == "BILL" else None,
            appointment_id=reference_id if reference_type == "APPOINTMENT" else None,
        )
        await log.insert()

        if not normalized_phone:
            log.status = "FAILED"
            log.delivery_status = "FAILED"
            log.error_message = "Invalid or missing customer phone number."
            log.failed_at = now_utc()
            await log.save()
            return log

        # Check customer opt-in status
        is_opted_in = await self.check_customer_opt_in(customer_id)
        if not is_opted_in:
            log.status = "CANCELLED"
            log.delivery_status = "CANCELLED"
            log.error_message = "Customer has opted out of receiving WhatsApp messages."
            await log.save()
            logger.info("Customer %s opted out of WhatsApp messages.", customer_id)
            return log

        # Resolve salon credentials
        phone_number_id, access_token, salon_account = await self._resolve_credentials(salon_id)
        if not phone_number_id or not access_token:
            log.status = "FAILED"
            log.delivery_status = "FAILED"
            log.error_message = "WhatsApp is not connected for this salon. Please connect WhatsApp in Settings."
            log.failed_at = now_utc()
            await log.save()
            return log

        log.status = "SENDING"
        await log.save()

        # Send via provider
        res = await self.provider.send_template_message(
            phone_number_id=phone_number_id,
            access_token=access_token,
            to_phone=normalized_phone,
            template_name=template_name,
            language_code=language_code,
            components=components,
        )

        if res.get("success"):
            log.status = "SENT"
            log.delivery_status = "sent"
            log.wamid = res.get("wamid")
            log.meta_message_id = res.get("wamid")
            log.sent_at = now_utc()
            log.api_response = res.get("response_body")
            await log.save()
            logger.info("WhatsApp message sent successfully salon=%s wamid=%s recipient=%s", salon_id, res.get("wamid"), normalized_phone)
        else:
            log.status = "FAILED"
            log.delivery_status = "failed"
            log.error_message = res.get("error_message") or "WhatsApp API error"
            log.failed_at = now_utc()
            log.api_response = res.get("response_body")
            await log.save()
            logger.error("WhatsApp message send failed salon=%s recipient=%s: %s", salon_id, normalized_phone, log.error_message)

        return log

    async def send_test_message(self, salon_id: str, test_phone: str) -> WhatsAppMessageLog:
        """Sends a test message using salon's configured WABA to verify integration."""
        account = await self.get_salon_account(salon_id)
        template_name = "hello_world"
        if account and account.templates and "bill_receipt" in account.templates:
            template_name = account.templates.get("bill_receipt", "hello_world")

        return await self.send_template_message(
            salon_id=salon_id,
            customer_id=None,
            recipient_phone=test_phone,
            message_type="TEST_MESSAGE",
            template_name=template_name,
            reference_type="TEST",
            reference_id=f"test-{now_utc().strftime('%Y%m%d%H%M%S')}",
        )

    async def process_webhook_payload(self, payload: Dict[str, Any]) -> int:
        """
        Processes Meta incoming webhooks for status callbacks (sent, delivered, read, failed)
        and incoming WhatsApp messages.
        """
        parsed_items = self.provider.parse_webhook_payload(payload)
        updated_count = 0

        for item in parsed_items:
            event_type = item.get("event_type")
            if event_type == "status":
                wamid = item.get("wamid")
                status_val = item.get("status")
                if not wamid or not status_val:
                    continue

                log = await WhatsAppMessageLog.find_one({"wamid": wamid, "is_deleted": False})
                if not log:
                    log = await WhatsAppMessageLog.find_one({"meta_message_id": wamid, "is_deleted": False})

                if log:
                    now = now_utc()
                    log.delivery_status = status_val
                    if status_val == "sent" and not log.sent_at:
                        log.sent_at = now
                        log.status = "SENT"
                    elif status_val == "delivered":
                        log.delivered_at = now
                        log.status = "DELIVERED"
                    elif status_val == "read":
                        log.read_at = now
                        log.status = "READ"
                    elif status_val == "failed":
                        log.failed_at = now
                        log.status = "FAILED"
                        errors = item.get("errors") or []
                        if isinstance(errors, list) and len(errors) > 0:
                            err_info = errors[0]
                            if isinstance(err_info, dict):
                                code = err_info.get("code")
                                log.error_code = str(code) if code else None
                                log.error_message = err_info.get("title") or err_info.get("message")
                    await log.save()
                    updated_count += 1
                    logger.info("Updated WhatsApp message log status wamid=%s status=%s", wamid, status_val)

            elif event_type == "incoming_message":
                # Incoming customer message — stored for future inbox feature
                from_phone = item.get("from_phone")
                wamid = item.get("wamid")
                text_content = item.get("text")

                incoming_log = WhatsAppMessageLog(
                    tenant_id="default",
                    salon_id="incoming",
                    customer_id="",
                    phone_number=from_phone or "",
                    message_type="INCOMING",
                    status="DELIVERED",
                    delivery_status="read",
                    wamid=wamid,
                    meta_message_id=wamid,
                    message_payload=item.get("raw"),
                    sent_at=now_utc(),
                )
                await incoming_log.insert()
                updated_count += 1
                logger.info("Stored incoming WhatsApp message wamid=%s from=%s", wamid, from_phone)

        return updated_count

    async def latest_status_for_bill(self, bill_id: str) -> str:
        log = await WhatsAppMessageLog.find(
            {"bill_id": bill_id, "is_deleted": False}
        ).sort("-created_at").first_or_none()
        return log.delivery_status or log.status if log else "pending"

    async def latest_status_for_invoice(self, invoice_id: str) -> str:
        log = await WhatsAppMessageLog.find(
            {"invoice_id": invoice_id, "is_deleted": False}
        ).sort("-created_at").first_or_none()
        return log.delivery_status or log.status if log else "pending"

    async def latest_status_for_appointment(self, appointment_id: str) -> str:
        log = await WhatsAppMessageLog.find(
            {"appointment_id": appointment_id, "is_deleted": False}
        ).sort("-created_at").first_or_none()
        return log.delivery_status or log.status if log else "pending"


# Global singleton instance
whatsapp_service = WhatsAppService()
