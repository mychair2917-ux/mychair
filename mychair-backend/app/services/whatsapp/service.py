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


def is_real_value(val: Optional[str]) -> bool:
    """Checks if a string is a non-empty, non-placeholder value."""
    if not val or not isinstance(val, str):
        return False
    stripped = val.strip()
    if not stripped:
        return False
    placeholders = {
        "pending_phone_id",
        "pending_waba_id",
        "pending meta setup",
        "pending",
    }
    return stripped.lower() not in placeholders


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
        if not account:
            return False
        if account.status != "CONNECTED":
            return False
        if not is_real_value(account.waba_id) or not is_real_value(account.phone_number_id) or not is_real_value(account.business_phone_number):
            return False
        if account.connection_status in ("VERIFICATION_REQUIRED", "COEXISTENCE_REQUIRED", "PHONE_SETUP_REQUIRED", "AUTHORIZED", "PHONE_SELECTION_REQUIRED"):
            return False
        return True

    async def connect_salon_waba(
        self,
        salon_id: str,
        tenant_id: str,
        waba_id: Optional[str],
        phone_number_id: Optional[str],
        business_phone_number: Optional[str],
        display_name: Optional[str],
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
        if access_token:
            auth_data["access_token"] = access_token
        auth_data["updated_at"] = now_utc().isoformat()
        if additional_auth_data:
            auth_data.update(additional_auth_data)

        clean_waba = waba_id if is_real_value(waba_id) else None
        clean_phone_id = phone_number_id if is_real_value(phone_number_id) else None
        clean_business_phone = business_phone_number if is_real_value(business_phone_number) else None

        account.waba_id = clean_waba
        account.phone_number_id = clean_phone_id
        account.business_phone_number = clean_business_phone
        account.display_name = display_name or "Salon WhatsApp"
        account.authorization_data = auth_data
        account.connection_status = connection_status

        # Determine status strictly from actual resolved Meta assets
        if connection_status in ("VERIFICATION_REQUIRED", "COEXISTENCE_REQUIRED", "PHONE_SELECTION_REQUIRED", "PHONE_SETUP_REQUIRED"):
            account.status = connection_status
        elif is_real_value(clean_waba) and is_real_value(clean_phone_id) and is_real_value(clean_business_phone) and connection_status in ("ACTIVE", "CONNECTED", "VERIFIED"):
            account.status = "CONNECTED"
            account.connected_at = now_utc()
            account.disconnected_at = None
        elif is_real_value(clean_waba) and not is_real_value(clean_phone_id):
            account.status = "AUTHORIZED"
        else:
            account.status = "PHONE_SETUP_REQUIRED"

        await account.save()
        logger.info("Salon %s WhatsApp status set to %s (connection_status=%s)", salon_id, account.status, connection_status)
        return account

    async def exchange_embedded_signup_code(
        self,
        salon_id: str,
        tenant_id: str,
        code: Optional[str] = None,
        waba_id: Optional[str] = None,
        phone_number_id: Optional[str] = None,
        direct_access_token: Optional[str] = None,
        redirect_uri: Optional[str] = None,
    ) -> SalonWhatsAppAccount:
        """
        Exchanges Meta Embedded Signup authorization code for a system access token,
        fetches & validates WABA and phone details directly from Meta Graph API,
        checks for WhatsApp Business App mobile coexistence requirements,
        and securely persists credentials to SalonWhatsAppAccount associated with salon_id and tenant_id.
        """
        access_token = None
        expires_in = None
        app_id = settings.META_APP_ID or settings.WHATSAPP_PHONE_NUMBER_ID
        app_secret = settings.WHATSAPP_APP_SECRET

        logger.info(
            "direct_access_token_present=%s code_present=%s credential_path=%s",
            str(bool(direct_access_token)).lower(),
            str(bool(code)).lower(),
            "DIRECT_TOKEN" if direct_access_token else ("AUTH_CODE" if code else "NONE")
        )

        if direct_access_token:
            logger.info("OAuth_code_exchange_called=false")
            if app_id and app_secret:
                try:
                    import httpx
                    async with httpx.AsyncClient(timeout=12.0) as client:
                        debug_url = "https://graph.facebook.com/debug_token"
                        debug_params = {
                            "input_token": direct_access_token,
                            "access_token": f"{app_id}|{app_secret}"
                        }
                        debug_resp = await client.get(debug_url, params=debug_params)
                        debug_data = debug_resp.json()
                        data_obj = debug_data.get("data", {})
                        
                        is_valid = bool(data_obj.get("is_valid"))
                        logger.info("debug_token_valid=%s", str(is_valid).lower())
                        if not is_valid:
                            logger.error("direct_access_token debug validation failed")
                            raise ValueError("Provided access token is invalid or expired.")
                            
                        token_app_id = data_obj.get("app_id")
                        app_id_matches = str(token_app_id) == str(app_id)
                        logger.info("token_app_id_matches=%s", str(app_id_matches).lower())
                        
                        if not app_id_matches:
                            logger.error("Token App ID %s does not match System App ID %s", token_app_id, app_id)
                            raise ValueError("Token belongs to a different Meta App ID.")
                            
                        scopes = data_obj.get("scopes", [])
                        if "whatsapp_business_management" not in scopes and "whatsapp_business_messaging" not in scopes:
                            logger.warning("direct_access_token might lack required WhatsApp scopes.")
                            
                        expires_at = data_obj.get("expires_at")
                        if expires_at and expires_at > 0:
                            expires_in = max(0, expires_at - int(datetime.now().timestamp()))
                            
                        token_type = data_obj.get("type", "").upper()
                        if token_type == "USER":
                            logger.info("token_extension_attempted=true")
                            extend_url = f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/oauth/access_token"
                            extend_params = {
                                "grant_type": "fb_exchange_token",
                                "client_id": app_id,
                                "client_secret": app_secret,
                                "fb_exchange_token": direct_access_token
                            }
                            extend_resp = await client.get(extend_url, params=extend_params)
                            extend_data = extend_resp.json()
                            if extend_resp.status_code == 200 and "access_token" in extend_data:
                                access_token = extend_data["access_token"]
                                expires_in = extend_data.get("expires_in", expires_in)
                            else:
                                err_msg = extend_data.get("error", {}).get("message", "Unknown error")
                                logger.error("Token extension failed")
                                raise ValueError(f"Token extension failed: {err_msg}")
                        else:
                            logger.info("token_extension_attempted=false")
                            access_token = direct_access_token
                except httpx.HTTPError as exc:
                    logger.exception("HTTP error during direct_access_token validation")
                    raise ValueError(f"Network error validating token with Meta: {str(exc)}")
            else:
                access_token = direct_access_token

        elif code:
            logger.info("OAuth_code_exchange_called=true")
            if app_id and app_secret:
                target_redirect_uri = settings.META_OAUTH_REDIRECT_URI or redirect_uri
                
                url = f"https://graph.facebook.com/{settings.WHATSAPP_API_VERSION}/oauth/access_token"
                params = {
                    "client_id": app_id,
                    "client_secret": app_secret,
                    "code": code,
                }
                
                if target_redirect_uri:
                    params["redirect_uri"] = target_redirect_uri

                try:
                    import httpx
                    async with httpx.AsyncClient(timeout=12.0) as client:
                        resp = await client.post(url, params=params)
                        body = resp.json()
                        if resp.status_code == 200 and "access_token" in body:
                            access_token = body["access_token"]
                            expires_in = body.get("expires_in")
                        else:
                            err_obj = body.get("error", {}) if isinstance(body, dict) else {}
                            error_msg = err_obj.get("message") or f"Meta OAuth token exchange failed (HTTP {resp.status_code})"
                            if not access_token:
                                raise ValueError(f"Meta authorization exchange failed: {error_msg}")
                except httpx.HTTPError as exc:
                    if not access_token:
                        raise ValueError(f"Network error exchanging code with Meta: {str(exc)}")

        if not access_token:
            access_token = settings.whatsapp_bearer_token

        if not access_token:
            raise ValueError("No access token acquired from Meta Embedded Signup code exchange.")

        # 2. Fetch WABA details & phone number details from Meta Graph API
        fetched_waba_id = waba_id if is_real_value(waba_id) else None
        fetched_phone_id = phone_number_id if is_real_value(phone_number_id) else None
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
                            if len(data_list) == 1:
                                fetched_waba_id = data_list[0].get("id")
                            elif len(data_list) > 1:
                                if waba_id and is_real_value(waba_id):
                                    matched = next((w for w in data_list if w.get("id") == waba_id), None)
                                    if matched:
                                        fetched_waba_id = matched.get("id")
                                if not fetched_waba_id:
                                    connection_status = "PHONE_SELECTION_REQUIRED"
                                    logger.warning(
                                        "Multiple WABAs found (%d WABAs) for salon %s and no unambiguous selection was made.",
                                        len(data_list),
                                        salon_id,
                                    )
                except Exception as exc:
                    logger.warning("Could not auto-resolve WABA ID: %s", exc)

            if fetched_waba_id and connection_status != "PHONE_SELECTION_REQUIRED":
                try:
                    async with httpx.AsyncClient(timeout=10.0) as client:
                        phone_url = f"https://graph.facebook.com/{api_ver}/{fetched_waba_id}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status,status,quality_rating,name_status"
                        p_resp = await client.get(phone_url, headers=headers)
                        p_data = p_resp.json()
                        meta_raw["phone_numbers"] = p_data

                        phones = p_data.get("data", [])
                        selected_phone = None
                        if phones and isinstance(phones, list):
                            if fetched_phone_id and is_real_value(fetched_phone_id):
                                selected_phone = next((p for p in phones if p.get("id") == fetched_phone_id), None)
                            elif len(phones) == 1:
                                selected_phone = phones[0]
                            elif len(phones) > 1:
                                connection_status = "PHONE_SELECTION_REQUIRED"
                                logger.warning(
                                    "Multiple phone numbers (%d phones) for WABA %s with no specific selection.",
                                    len(phones),
                                    fetched_waba_id,
                                )

                        if selected_phone:
                            fetched_phone_id = selected_phone.get("id")
                            business_phone = selected_phone.get("display_phone_number")
                            display_name = selected_phone.get("verified_name") or selected_phone.get("display_name")

                            ver_status = selected_phone.get("code_verification_status")
                            p_status = selected_phone.get("status")
                            if ver_status and ver_status != "VERIFIED":
                                connection_status = "VERIFICATION_REQUIRED"
                            elif p_status in ("MIGRATION_REQUIRED", "COEXISTENCE_REQUIRED"):
                                connection_status = "COEXISTENCE_REQUIRED"
                            elif p_status in ("UNVERIFIED", "NOT_VERIFIED"):
                                connection_status = "VERIFICATION_REQUIRED"
                        elif connection_status != "PHONE_SELECTION_REQUIRED" and not fetched_phone_id:
                            connection_status = "PHONE_SETUP_REQUIRED"
                except Exception as exc:
                    logger.warning("Could not query Meta phone numbers for WABA %s: %s", fetched_waba_id, exc)

        clean_waba = fetched_waba_id if is_real_value(fetched_waba_id) else None
        clean_phone = fetched_phone_id if is_real_value(fetched_phone_id) else None
        clean_biz_phone = business_phone if is_real_value(business_phone) else None

        if not clean_waba or not clean_phone or not clean_biz_phone:
            if connection_status not in ("COEXISTENCE_REQUIRED", "VERIFICATION_REQUIRED", "PHONE_SELECTION_REQUIRED"):
                connection_status = "AUTHORIZED" if clean_waba else "PHONE_SETUP_REQUIRED"

        additional_data = {
            "token_expires_in": expires_in,
            "meta_raw": meta_raw,
        }

        account = await self.connect_salon_waba(
            salon_id=salon_id,
            tenant_id=tenant_id,
            waba_id=clean_waba,
            phone_number_id=clean_phone,
            business_phone_number=clean_biz_phone,
            display_name=display_name or "Salon WhatsApp",
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
        """Resolves Phone Number ID and Access Token for a specific salon."""
        account = await self.get_salon_account(salon_id)
        if not account:
            return None, None, None

        if await self.is_salon_connected(salon_id):
            token = (account.authorization_data or {}).get("access_token") or settings.whatsapp_bearer_token
            if is_real_value(account.phone_number_id) and token:
                return account.phone_number_id, token, account

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
