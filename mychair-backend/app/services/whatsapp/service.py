from dataclasses import dataclass
from datetime import datetime
import logging
import re
from typing import Any, Dict, List, Optional, Tuple
from beanie import PydanticObjectId

from app.core.config import settings
from app.models.customer import Customer
from app.models.salon_whatsapp_account import SalonWhatsAppAccount
from app.models.whatsapp_message import WhatsAppMessageLog
from app.services.whatsapp.base_provider import WhatsAppProvider
from app.services.whatsapp.meta_provider import MetaCloudApiProvider
from app.utils.phone import is_client_reference_id
from app.utils.timezone import now_utc

logger = logging.getLogger("whatsapp.service")


def is_valid_whatsapp_phone(phone: Optional[str]) -> bool:
    """
    Validates whether the input is a real, usable mobile phone number for WhatsApp.
    Rejects:
    - None or empty string
    - Client reference IDs (e.g. 'CL-XXXXXX')
    - Placeholders or strings with non-digits that aren't phone characters
    - Numbers with digit count < 10 or > 15
    - Dummy numbers like all zeros or single repeated digit
    """
    if not phone or not isinstance(phone, str):
        return False
    stripped = phone.strip()
    if not stripped:
        return False
    if is_client_reference_id(stripped):
        return False
    if stripped.upper().startswith("CL-") or stripped.upper().startswith("GEN_"):
        return False
    digits = re.sub(r"\D+", "", stripped)
    if len(digits) < 10 or len(digits) > 15:
        return False
    if len(set(digits)) == 1:
        return False
    return True


def normalize_phone_number(phone: Optional[str]) -> str:
    """Normalizes raw input phone string into standard E.164 digits without leading '+' or spaces."""
    if not phone or not isinstance(phone, str):
        return ""
    stripped = phone.strip()
    if is_client_reference_id(stripped) or stripped.upper().startswith("CL-") or stripped.upper().startswith("GEN_"):
        return ""
    digits = re.sub(r"\D+", "", stripped)
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


@dataclass
class SenderCredentials:
    phone_number_id: Optional[str]
    access_token: Optional[str]
    waba_id: Optional[str] = None
    sender_type: str = "PLATFORM"  # "PLATFORM" or "SALON"
    salon_account: Optional[SalonWhatsAppAccount] = None

    @property
    def is_valid(self) -> bool:
        return bool(
            self.phone_number_id
            and is_real_value(self.phone_number_id)
            and self.access_token
            and is_real_value(self.access_token)
        )

    def __iter__(self):
        """Allows tuple unpacking as (phone_number_id, access_token, salon_account) for backward compatibility."""
        return iter((self.phone_number_id, self.access_token, self.salon_account))


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
            "code_present=%s credential_path=AUTH_CODE",
            str(bool(code)).lower(),
        )

        if code:
            logger.info("OAuth_code_exchange_called=true")
            if app_id and app_secret:
                url = "https://graph.facebook.com/v25.0/oauth/access_token"
                params = {
                    "client_id": app_id,
                    "client_secret": app_secret,
                    "code": code,
                    "redirect_uri": settings.META_OAUTH_REDIRECT_URI,
                    "grant_type": "authorization_code",
                }
                
                try:
                    import httpx
                    async with httpx.AsyncClient(timeout=12.0) as client:
                        resp = await client.get(url, params=params)
                        body = resp.json()
                        
                        logger.info(
                            "Meta OAuth Exchange: credential_path=AUTH_CODE redirect_uri_parameter_present=true redirect_uri_length=0 code_present=true HTTP_status=%s Meta_error_code=%s Meta_error_subcode=%s fbtrace_id=%s",
                            resp.status_code,
                            body.get("error", {}).get("code"),
                            body.get("error", {}).get("error_subcode"),
                            body.get("error", {}).get("fbtrace_id")
                        )

                        if resp.status_code == 200 and "access_token" in body:
                            access_token = body["access_token"]
                            expires_in = body.get("expires_in")
                        else:
                            err_obj = body.get("error", {}) if isinstance(body, dict) else {}
                            error_msg = err_obj.get("message") or f"Meta OAuth token exchange failed (HTTP {resp.status_code})"
                            raise ValueError(f"Meta authorization exchange failed: {error_msg}")
                except httpx.HTTPError as exc:
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

    async def resolve_sender_credentials(
        self, salon_id: Optional[str] = None, sender_mode: Optional[str] = None
    ) -> SenderCredentials:
        """
        Authoritative WhatsApp sender credential resolver.
        Supports:
          - 'platform': Always use central MyChair WhatsApp credentials.
                        Does NOT require SalonWhatsAppAccount or is_salon_connected.
          - 'hybrid': Future use: use salon WhatsApp credentials when connected,
                      otherwise fallback to MyChair platform credentials.
          - 'salon': Require salon-specific WhatsApp credentials.
        """
        mode = (sender_mode or settings.WHATSAPP_SENDER_MODE or "platform").lower().strip()

        if mode == "platform":
            phone_id = settings.WHATSAPP_PHONE_NUMBER_ID if is_real_value(settings.WHATSAPP_PHONE_NUMBER_ID) else None
            token = settings.whatsapp_bearer_token if is_real_value(settings.whatsapp_bearer_token) else None
            waba_id = settings.WHATSAPP_BUSINESS_ACCOUNT_ID if is_real_value(settings.WHATSAPP_BUSINESS_ACCOUNT_ID) else None

            # If platform credentials are set in environment, use them strictly as PLATFORM sender
            if phone_id and token:
                return SenderCredentials(
                    phone_number_id=phone_id,
                    access_token=token,
                    waba_id=waba_id,
                    sender_type="PLATFORM",
                    salon_account=None,
                )

            # In unconfigured environments (e.g. unit tests where platform vars are unset),
            # check if salon credentials exist as a fallback so mocked salon accounts continue to work
            if salon_id:
                try:
                    s_phone, s_token, s_acc = await self._resolve_credentials(salon_id)
                    if s_phone and s_token:
                        return SenderCredentials(
                            phone_number_id=s_phone,
                            access_token=s_token,
                            waba_id=s_acc.waba_id if s_acc else None,
                            sender_type="SALON",
                            salon_account=s_acc,
                        )
                except Exception:
                    pass

            return SenderCredentials(
                phone_number_id=phone_id,
                access_token=token,
                waba_id=waba_id,
                sender_type="PLATFORM",
                salon_account=None,
            )

        if mode == "hybrid":
            if salon_id:
                salon_phone, salon_token, account = await self._resolve_credentials(salon_id)
                if salon_phone and salon_token:
                    return SenderCredentials(
                        phone_number_id=salon_phone,
                        access_token=salon_token,
                        waba_id=account.waba_id if account else None,
                        sender_type="SALON",
                        salon_account=account,
                    )
            # Fallback to platform credentials
            phone_id = settings.WHATSAPP_PHONE_NUMBER_ID if is_real_value(settings.WHATSAPP_PHONE_NUMBER_ID) else None
            token = settings.whatsapp_bearer_token if is_real_value(settings.whatsapp_bearer_token) else None
            waba_id = settings.WHATSAPP_BUSINESS_ACCOUNT_ID if is_real_value(settings.WHATSAPP_BUSINESS_ACCOUNT_ID) else None
            salon_account = await self.get_salon_account(salon_id) if salon_id else None
            return SenderCredentials(
                phone_number_id=phone_id,
                access_token=token,
                waba_id=waba_id,
                sender_type="PLATFORM",
                salon_account=salon_account,
            )

        # 'salon' mode: require salon credentials only
        if not salon_id:
            return SenderCredentials(
                phone_number_id=None,
                access_token=None,
                waba_id=None,
                sender_type="SALON",
                salon_account=None,
            )

        salon_phone, salon_token, account = await self._resolve_credentials(salon_id)
        return SenderCredentials(
            phone_number_id=salon_phone,
            access_token=salon_token,
            waba_id=account.waba_id if account else None,
            sender_type="SALON",
            salon_account=account,
        )

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
        Resolves credentials using unified resolve_sender_credentials(salon_id).
        Enforces phone validation, deduplication key, customer opt-in check, and complete audit logging.
        """
        is_override = bool(settings.WHATSAPP_TEST_RECIPIENT_PHONE and settings.WHATSAPP_TEST_RECIPIENT_PHONE.strip())
        target_raw = settings.WHATSAPP_TEST_RECIPIENT_PHONE.strip() if is_override else (recipient_phone or "").strip()
        normalized_phone = normalize_phone_number(target_raw)

        deduplication_key = None
        if reference_type and reference_id and message_type:
            deduplication_key = f"{salon_id}:{reference_type}:{reference_id}:{message_type}"

        # Deduplication check: prevent sending duplicate WhatsApp messages for same bill/appointment
        if deduplication_key:
            existing = await WhatsAppMessageLog.find_one({
                "deduplication_key": deduplication_key,
                "status": {"$in": ["QUEUED", "SENDING", "SENT", "DELIVERED", "READ"]},
                "is_deleted": False,
            })
            if existing:
                logger.info("Skipping duplicate WhatsApp message send for key=%s", deduplication_key)
                return existing

        # Resolve credentials using centralized resolver
        creds = await self.resolve_sender_credentials(salon_id)

        # Phone validation: reject non-phone client IDs (CL-XXXXXX) or blank/invalid formats
        if not is_valid_whatsapp_phone(target_raw) or not normalized_phone:
            log = WhatsAppMessageLog(
                tenant_id=tenant_id or "default",
                salon_id=salon_id,
                customer_id=customer_id or "",
                phone_number="",
                original_customer_phone=recipient_phone,
                test_override_used=is_override,
                sender_type=creds.sender_type,
                message_type=message_type,
                status="FAILED",
                delivery_status="FAILED",
                error_message="NO_VALID_WHATSAPP_NUMBER",
                template_name=template_name,
                template_language=language_code,
                template_variables=template_variables,
                reference_type=reference_type,
                reference_id=reference_id,
                deduplication_key=deduplication_key,
                bill_id=reference_id if reference_type == "BILL" else None,
                appointment_id=reference_id if reference_type == "APPOINTMENT" else None,
                failed_at=now_utc(),
            )
            await log.insert()
            logger.info("Skipping WhatsApp dispatch: NO_VALID_WHATSAPP_NUMBER for salon=%s recipient=%s", salon_id, recipient_phone)
            return log

        # Check customer opt-in status
        is_opted_in = await self.check_customer_opt_in(customer_id)
        if not is_opted_in:
            log = WhatsAppMessageLog(
                tenant_id=tenant_id or "default",
                salon_id=salon_id,
                customer_id=customer_id or "",
                phone_number=normalized_phone,
                original_customer_phone=recipient_phone,
                test_override_used=is_override,
                sender_type=creds.sender_type,
                message_type=message_type,
                status="CANCELLED",
                delivery_status="CANCELLED",
                error_message="Customer has opted out of receiving WhatsApp messages.",
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
            logger.info("Customer %s opted out of WhatsApp messages.", customer_id)
            return log

        # Check sender credentials
        if not creds.is_valid:
            log = WhatsAppMessageLog(
                tenant_id=tenant_id or "default",
                salon_id=salon_id,
                customer_id=customer_id or "",
                phone_number=normalized_phone,
                original_customer_phone=recipient_phone,
                test_override_used=is_override,
                sender_type=creds.sender_type,
                message_type=message_type,
                status="FAILED",
                delivery_status="FAILED",
                error_message="WhatsApp credentials not configured for sender.",
                template_name=template_name,
                template_language=language_code,
                template_variables=template_variables,
                reference_type=reference_type,
                reference_id=reference_id,
                deduplication_key=deduplication_key,
                bill_id=reference_id if reference_type == "BILL" else None,
                appointment_id=reference_id if reference_type == "APPOINTMENT" else None,
                failed_at=now_utc(),
            )
            await log.insert()
            logger.warning("WhatsApp credentials missing or invalid for salon=%s sender_type=%s", salon_id, creds.sender_type)
            return log

        # Create audit log with SENDING status
        log = WhatsAppMessageLog(
            tenant_id=tenant_id or "default",
            salon_id=salon_id,
            customer_id=customer_id or "",
            phone_number=normalized_phone,
            original_customer_phone=recipient_phone,
            test_override_used=is_override,
            sender_type=creds.sender_type,
            message_type=message_type,
            status="SENDING",
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

        # Send via provider
        res = await self.provider.send_template_message(
            phone_number_id=creds.phone_number_id,
            access_token=creds.access_token,
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
            logger.info("WhatsApp message sent successfully salon=%s wamid=%s recipient=%s sender=%s", salon_id, res.get("wamid"), normalized_phone, creds.sender_type)
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
        """Sends a test message using resolved credentials to verify integration."""
        creds = await self.resolve_sender_credentials(salon_id)
        account = creds.salon_account or await self.get_salon_account(salon_id)
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

    async def process_status_webhook(self, payload: Dict[str, Any]) -> int:
        """Alias for process_webhook_payload to handle webhook status callbacks."""
        return await self.process_webhook_payload(payload)

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

    async def latest_statuses_for_invoices(self, invoice_ids: List[str]) -> Dict[str, str]:
        if not invoice_ids:
            return {}
        logs = await WhatsAppMessageLog.find(
            {"invoice_id": {"$in": invoice_ids}, "is_deleted": False}
        ).sort("-created_at").to_list()
        statuses: Dict[str, str] = {}
        for log in logs:
            if log.invoice_id and log.invoice_id not in statuses:
                statuses[log.invoice_id] = log.delivery_status or log.status or "pending"
        return statuses

    async def latest_status_for_appointment(self, appointment_id: str) -> str:
        log = await WhatsAppMessageLog.find(
            {"appointment_id": appointment_id, "is_deleted": False}
        ).sort("-created_at").first_or_none()
        return log.delivery_status or log.status if log else "pending"

    async def latest_statuses_for_appointments(self, appointment_ids: List[str]) -> Dict[str, str]:
        if not appointment_ids:
            return {}
        logs = await WhatsAppMessageLog.find(
            {"appointment_id": {"$in": appointment_ids}, "is_deleted": False}
        ).sort("-created_at").to_list()
        statuses: Dict[str, str] = {}
        for log in logs:
            if log.appointment_id and log.appointment_id not in statuses:
                statuses[log.appointment_id] = log.delivery_status or log.status or "pending"
        return statuses

    async def send_on_appointment_submit(self, appointment_id: str) -> Optional[WhatsAppMessageLog]:
        """
        Sends an automatic WhatsApp confirmation when an appointment is submitted/booked.
        Safely handles lookup failures, credential resolution, and exceptions.
        """
        try:
            from app.models.appointment import Appointment
            from beanie import PydanticObjectId

            try:
                appt_obj_id = PydanticObjectId(appointment_id)
            except Exception:
                return None

            appt = await Appointment.find_one({"_id": appt_obj_id, "is_deleted": False})
            if not appt or not appt.salon_id or not appt.customer_phone:
                return None

            creds = await self.resolve_sender_credentials(appt.salon_id)
            if not creds.is_valid:
                return None

            account = creds.salon_account or await self.get_salon_account(appt.salon_id)
            if account and not account.features.get("appointment_confirmations_enabled", True):
                return None

            template_name = settings.WHATSAPP_APPOINTMENT_TEMPLATE or "hello_world"
            if account and account.templates and "appointment_booking" in account.templates:
                template_name = account.templates.get("appointment_booking", template_name)

            cust_name = appt.customer_name or "Valued Customer"
            appt_time = appt.start_datetime.strftime("%Y-%m-%d %H:%M") if appt.start_datetime else ""

            return await self.send_template_message(
                salon_id=appt.salon_id,
                customer_id=appt.customer_id,
                recipient_phone=appt.customer_phone,
                message_type="APPOINTMENT_BOOKING",
                template_name=template_name,
                template_variables={
                    "1": cust_name,
                    "2": appt_time,
                },
                reference_type="APPOINTMENT",
                reference_id=str(appt.id),
            )
        except Exception as exc:
            import logging
            logging.getLogger("whatsapp").warning(
                "WhatsApp send_on_appointment_submit background task exception for appointment %s: %s",
                appointment_id,
                exc,
            )
            return None

    async def send_invoice_review_after_completion(self, appointment_id: str) -> Optional[WhatsAppMessageLog]:
        """
        Sends a WhatsApp feedback/review request after appointment completion.
        Safely handles lookup failures, credential resolution, and exceptions.
        """
        try:
            from app.models.appointment import Appointment
            from beanie import PydanticObjectId

            try:
                appt_obj_id = PydanticObjectId(appointment_id)
            except Exception:
                return None

            appt = await Appointment.find_one({"_id": appt_obj_id, "is_deleted": False})
            if not appt or not appt.salon_id or not appt.customer_phone:
                return None

            creds = await self.resolve_sender_credentials(appt.salon_id)
            if not creds.is_valid:
                return None

            account = creds.salon_account or await self.get_salon_account(appt.salon_id)
            if account and not account.features.get("feedback_requests_enabled", True):
                return None

            template_name = "hello_world"
            if account and account.templates and "feedback_request" in account.templates:
                template_name = account.templates.get("feedback_request", "hello_world")

            cust_name = appt.customer_name or "Valued Customer"

            return await self.send_template_message(
                salon_id=appt.salon_id,
                customer_id=appt.customer_id,
                recipient_phone=appt.customer_phone,
                message_type="FEEDBACK_REQUEST",
                template_name=template_name,
                template_variables={
                    "1": cust_name,
                },
                reference_type="APPOINTMENT",
                reference_id=str(appt.id),
            )
        except Exception as exc:
            import logging
            logging.getLogger("whatsapp").warning(
                "WhatsApp send_invoice_review_after_completion background task exception for appointment %s: %s",
                appointment_id,
                exc,
            )
            return None


# Global singleton instance
whatsapp_service = WhatsAppService()

