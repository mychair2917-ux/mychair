import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.core.config import settings
from app.models.salon_whatsapp_account import SalonWhatsAppAccount
from app.models.whatsapp_message import WhatsAppMessageLog
from app.services.whatsapp import WhatsAppService, normalize_phone_number, is_valid_whatsapp_phone
from app.services.whatsapp.service import SenderCredentials
from app.api.v1.endpoints.whatsapp import _sanitize_account_dict


def make_mock_log(**kwargs):
    """Helper to instantiate mock WhatsAppMessageLog capturing all constructor kwargs."""
    m = MagicMock(spec=WhatsAppMessageLog)
    for k, v in kwargs.items():
        setattr(m, k, v)
    m.insert = AsyncMock()
    m.save = AsyncMock()
    return m


# ==============================================================================
# TEST A: Platform mode works even when salon has NO SalonWhatsAppAccount
# ==============================================================================
@pytest.mark.asyncio
async def test_platform_mode_works_without_salon_account(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id-123")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-access-token-xyz")
    monkeypatch.setattr(settings, "WHATSAPP_BUSINESS_ACCOUNT_ID", "central-waba-id-456")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    # Mock that salon has NO SalonWhatsAppAccount at all
    service.get_salon_account = AsyncMock(return_value=None)
    service.is_salon_connected = AsyncMock(return_value=False)

    creds = await service.resolve_sender_credentials("unconnected-salon-001")
    assert creds.is_valid is True
    assert creds.sender_type == "PLATFORM"
    assert creds.phone_number_id == "central-phone-id-123"
    assert creds.access_token == "central-access-token-xyz"


# ==============================================================================
# TEST B: Platform mode uses WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN
# ==============================================================================
@pytest.mark.asyncio
async def test_platform_mode_uses_configured_credentials(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-999")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token-secret")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=None)

    with patch.object(service.provider, "send_template_message", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {
            "success": True,
            "status_code": 200,
            "wamid": "wamid.platform.001",
            "error_message": None,
        }
        with patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=make_mock_log) as mock_log_cls:
            mock_log_cls.find_one = AsyncMock(return_value=None)

            log = await service.send_template_message(
                salon_id="salon-no-account",
                customer_id=None,
                recipient_phone="9876543210",
                message_type="BILL_RECEIPT",
                template_name="hello_world",
            )

            mock_send.assert_called_once()
            call_kwargs = mock_send.call_args.kwargs
            assert call_kwargs["phone_number_id"] == "central-phone-999"
            assert call_kwargs["access_token"] == "central-token-secret"
            assert log.sender_type == "PLATFORM"


# ==============================================================================
# TEST C: Real customer phone is passed when WHATSAPP_TEST_RECIPIENT_PHONE is empty
# ==============================================================================
@pytest.mark.asyncio
async def test_real_customer_phone_used_when_test_recipient_empty(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=None)

    with patch.object(service.provider, "send_template_message", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"success": True, "wamid": "wamid.real.phone"}
        with patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=make_mock_log) as mock_log_cls:
            mock_log_cls.find_one = AsyncMock(return_value=None)

            log = await service.send_template_message(
                salon_id="salon-1",
                customer_id=None,
                recipient_phone="9876543210",
                message_type="BILL_RECEIPT",
                template_name="hello_world",
            )

            assert mock_send.call_args.kwargs["to_phone"] == "919876543210"
            assert log.test_override_used is False


# ==============================================================================
# TEST D: WHATSAPP_TEST_RECIPIENT_PHONE works only when explicitly configured
# ==============================================================================
@pytest.mark.asyncio
async def test_test_recipient_override_works_when_explicitly_configured(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "+919999988888")

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=None)

    with patch.object(service.provider, "send_template_message", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {"success": True, "wamid": "wamid.override"}
        with patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=make_mock_log) as mock_log_cls:
            mock_log_cls.find_one = AsyncMock(return_value=None)

            log = await service.send_template_message(
                salon_id="salon-1",
                customer_id=None,
                recipient_phone="9876543210",
                message_type="BILL_RECEIPT",
                template_name="hello_world",
            )

            assert mock_send.call_args.kwargs["to_phone"] == "919999988888"
            assert log.test_override_used is True


# ==============================================================================
# TEST E: Completed bill schedules exactly one WhatsApp message
# ==============================================================================
@pytest.mark.asyncio
async def test_completed_bill_schedules_whatsapp_message(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_BILLING_TEMPLATE", "hello_world")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    from app.services.billing import BillingService
    billing_service = BillingService()
    billing_service._generate_invoice_number = AsyncMock(return_value="INV-2026-001")
    billing_service.inventory_service = MagicMock()
    billing_service.inventory_service.deduct_sold_product = AsyncMock()

    mock_invoice = MagicMock()
    mock_invoice.id = "inv-123"
    mock_invoice.status = "FINALIZED"
    mock_invoice.invoice_number = "INV-2026-001"
    mock_invoice.total_amount = 500.0
    mock_invoice.insert = AsyncMock()

    mock_payment = MagicMock()
    mock_payment.insert = AsyncMock()

    with patch("app.services.billing.Invoice") as mock_invoice_cls, \
         patch("app.services.billing.Payment") as mock_payment_cls:
        mock_invoice_cls.return_value = mock_invoice
        mock_invoice_cls.find_one = AsyncMock(return_value=None)
        mock_payment_cls.return_value = mock_payment
        with patch("app.services.whatsapp.whatsapp_service.send_template_message", new_callable=AsyncMock) as mock_send_tpl:
            mock_send_tpl.return_value = MagicMock(status="SENT")

            invoice = await billing_service.create_invoice_from_appointment(
                salon_id="salon-123",
                appointment_id="appt-123",
                salon_name="My Salon",
                salon_phone="9876543210",
                salon_address="123 High Street",
                customer_id="cust-123",
                customer_name="Jane Doe",
                customer_phone="9876543210",
                services=[{"service_id": "s1", "name": "Haircut", "price": 500.0}],
                products=[],
                payment_status="PAID",
                payment_method="CASH",
                total_amount=500.0,
                paid_amount=500.0,
            )

            assert invoice is not None
            mock_send_tpl.assert_called_once()
            kwargs = mock_send_tpl.call_args.kwargs
            assert kwargs["salon_id"] == "salon-123"
            assert kwargs["recipient_phone"] == "9876543210"
            assert kwargs["message_type"] == "BILL_RECEIPT"
            assert kwargs["template_name"] == "hello_world"
            assert kwargs["reference_type"] == "BILL"


# ==============================================================================
# TEST F: Duplicate billing retries do not produce duplicate WhatsApp sends
# ==============================================================================
@pytest.mark.asyncio
async def test_duplicate_billing_retries_prevented(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=None)

    existing_log = MagicMock(spec=WhatsAppMessageLog)
    existing_log.status = "SENT"
    existing_log.wamid = "wamid.existing.123"

    with patch.object(service.provider, "send_template_message", new_callable=AsyncMock) as mock_send:
        with patch("app.services.whatsapp.service.WhatsAppMessageLog.find_one", AsyncMock(return_value=existing_log)):
            log = await service.send_template_message(
                salon_id="salon-123",
                customer_id="cust-123",
                recipient_phone="9876543210",
                message_type="BILL_RECEIPT",
                template_name="hello_world",
                reference_type="BILL",
                reference_id="bill-999",
            )

            # Provider should NOT be called because deduplication detected existing log
            mock_send.assert_not_called()
            assert log == existing_log


# ==============================================================================
# TEST G: Invalid/missing customer phone skips WhatsApp but billing succeeds
# ==============================================================================
@pytest.mark.asyncio
async def test_invalid_or_missing_phone_skips_whatsapp(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=None)

    with patch.object(service.provider, "send_template_message", new_callable=AsyncMock) as mock_send:
        with patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=make_mock_log) as mock_log_cls:
            mock_log_cls.find_one = AsyncMock(return_value=None)

            log = await service.send_template_message(
                salon_id="salon-123",
                customer_id="cust-123",
                recipient_phone="12345",  # Invalid length
                message_type="BILL_RECEIPT",
                template_name="hello_world",
            )

            mock_send.assert_not_called()
            assert log.error_message == "NO_VALID_WHATSAPP_NUMBER"
            assert log.status == "FAILED"


# ==============================================================================
# TEST H: Generated non-phone customer IDs (CL-XXXXXX) are never sent to Meta
# ==============================================================================
@pytest.mark.asyncio
async def test_generated_client_id_never_sent_to_meta(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=None)

    assert is_valid_whatsapp_phone("CL-A8K9P2") is False
    assert normalize_phone_number("CL-A8K9P2") == ""

    with patch.object(service.provider, "send_template_message", new_callable=AsyncMock) as mock_send:
        with patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=make_mock_log) as mock_log_cls:
            mock_log_cls.find_one = AsyncMock(return_value=None)

            log = await service.send_template_message(
                salon_id="salon-123",
                customer_id="cust-123",
                recipient_phone="CL-A8K9P2",
                message_type="BILL_RECEIPT",
                template_name="hello_world",
            )

            mock_send.assert_not_called()
            assert log.error_message == "NO_VALID_WHATSAPP_NUMBER"
            assert log.status == "FAILED"


# ==============================================================================
# TEST I: Customer opt-out prevents sending
# ==============================================================================
@pytest.mark.asyncio
async def test_customer_opt_out_prevents_sending(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=None)

    # Customer explicitly opted out
    with patch.object(service, "check_customer_opt_in", AsyncMock(return_value=False)):
        with patch.object(service.provider, "send_template_message", new_callable=AsyncMock) as mock_send:
            with patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=make_mock_log) as mock_log_cls:
                mock_log_cls.find_one = AsyncMock(return_value=None)

                log = await service.send_template_message(
                    salon_id="salon-123",
                    customer_id="cust-optout",
                    recipient_phone="9876543210",
                    message_type="BILL_RECEIPT",
                    template_name="hello_world",
                )

                mock_send.assert_not_called()
                assert log.status == "CANCELLED"
                assert "opted out" in log.error_message


# ==============================================================================
# TEST J: Meta API failure does not fail billing
# ==============================================================================
@pytest.mark.asyncio
async def test_meta_api_failure_does_not_fail_billing(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_BILLING_TEMPLATE", "hello_world")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    from app.services.billing import BillingService
    billing_service = BillingService()
    billing_service._generate_invoice_number = AsyncMock(return_value="INV-2026-002")
    billing_service.inventory_service = MagicMock()
    billing_service.inventory_service.deduct_sold_product = AsyncMock()

    mock_invoice = MagicMock()
    mock_invoice.id = "inv-123"
    mock_invoice.status = "FINALIZED"
    mock_invoice.invoice_number = "INV-2026-002"
    mock_invoice.total_amount = 500.0
    mock_invoice.insert = AsyncMock()

    mock_payment = MagicMock()
    mock_payment.insert = AsyncMock()

    with patch("app.services.billing.Invoice") as mock_invoice_cls, \
         patch("app.services.billing.Payment") as mock_payment_cls:
        mock_invoice_cls.return_value = mock_invoice
        mock_invoice_cls.find_one = AsyncMock(return_value=None)
        mock_payment_cls.return_value = mock_payment
        # Simulate Meta API error throwing an exception
        with patch("app.services.whatsapp.whatsapp_service.send_template_message", AsyncMock(side_effect=RuntimeError("Meta network failure 503"))):
            # Billing MUST succeed completely despite WhatsApp failure
            invoice = await billing_service.create_invoice_from_appointment(
                salon_id="salon-123",
                appointment_id="appt-123",
                salon_name="My Salon",
                salon_phone="9876543210",
                salon_address="123 High Street",
                customer_id="cust-123",
                customer_name="Jane Doe",
                customer_phone="9876543210",
                services=[{"service_id": "s1", "name": "Haircut", "price": 500.0}],
                products=[],
                payment_status="PAID",
                payment_method="CASH",
                total_amount=500.0,
                paid_amount=500.0,
            )

            assert invoice is not None
            assert invoice.status == "FINALIZED"


# ==============================================================================
# TEST K: Meta wamid is stored
# ==============================================================================
@pytest.mark.asyncio
async def test_meta_wamid_is_stored(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=None)

    expected_wamid = "wamid.HBgLOTE5ODc2NTQzMjEwFQIAERgSQjE4QjQ2NTE2ODlEOEYwOEEyAA=="

    with patch.object(service.provider, "send_template_message", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = {
            "success": True,
            "status_code": 200,
            "wamid": expected_wamid,
            "error_message": None,
            "response_body": {"messages": [{"id": expected_wamid}]},
        }
        with patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=make_mock_log) as mock_log_cls:
            mock_log_cls.find_one = AsyncMock(return_value=None)

            log = await service.send_template_message(
                salon_id="salon-123",
                customer_id="cust-1",
                recipient_phone="9876543210",
                message_type="BILL_RECEIPT",
                template_name="hello_world",
            )

            assert log.wamid == expected_wamid
            assert log.meta_message_id == expected_wamid
            assert log.status == "SENT"


# ==============================================================================
# TEST L: Webhook SENT/DELIVERED/READ/FAILED updates same message log
# ==============================================================================
@pytest.mark.asyncio
async def test_webhook_status_lifecycle_updates_log():
    service = WhatsAppService()

    target_wamid = "wamid.test.lifecycle.001"
    mock_log = MagicMock(spec=WhatsAppMessageLog)
    mock_log.status = "SENT"
    mock_log.delivery_status = "sent"
    mock_log.sent_at = None
    mock_log.delivered_at = None
    mock_log.read_at = None
    mock_log.failed_at = None
    mock_log.save = AsyncMock()

    with patch("app.services.whatsapp.service.WhatsAppMessageLog.find_one", AsyncMock(return_value=mock_log)):
        # 1. Delivered callback
        delivered_payload = {
            "entry": [{"changes": [{"value": {"statuses": [{"id": target_wamid, "status": "delivered"}]}}]}]
        }
        updated = await service.process_webhook_payload(delivered_payload)
        assert updated == 1
        assert mock_log.status == "DELIVERED"
        assert mock_log.delivery_status == "delivered"

        # 2. Read callback
        read_payload = {
            "entry": [{"changes": [{"value": {"statuses": [{"id": target_wamid, "status": "read"}]}}]}]
        }
        updated = await service.process_webhook_payload(read_payload)
        assert updated == 1
        assert mock_log.status == "READ"
        assert mock_log.delivery_status == "read"


# ==============================================================================
# TEST M: Access token is never returned by API or audit endpoints
# ==============================================================================
def test_access_token_never_returned_in_sanitized_account_dict():
    account = MagicMock(spec=SalonWhatsAppAccount)
    account.id = "60f7b1b3b3f3b3f3b3f3b3f3"
    account.salon_id = "salon-sec-test"
    account.status = "CONNECTED"
    account.connection_status = "ACTIVE"
    account.waba_id = "waba-001"
    account.phone_number_id = "phone-001"
    account.business_phone_number = "+919876543210"
    account.display_name = "My Salon"
    account.connected_at = None
    account.disconnected_at = None
    account.features = {"billing_enabled": True}
    account.templates = {"bill_receipt": "hello_world"}
    account.authorization_data = {
        "access_token": "EAA_CRITICAL_SECRET_NEVER_EXPOSE",
        "system_token": "SUPER_SECRET_TOKEN",
    }

    sanitized = _sanitize_account_dict(account, "salon-sec-test")
    assert "access_token" not in sanitized
    assert "authorization_data" not in sanitized
    assert "system_token" not in sanitized
    assert "EAA_CRITICAL_SECRET_NEVER_EXPOSE" not in str(sanitized)


# ==============================================================================
# TEST N: Existing appointment WhatsApp flow uses platform sender in platform mode
# ==============================================================================
@pytest.mark.asyncio
async def test_appointment_flow_uses_platform_sender_in_platform_mode(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_APPOINTMENT_TEMPLATE", "hello_world")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    # Unconnected salon
    service.get_salon_account = AsyncMock(return_value=None)
    service.is_salon_connected = AsyncMock(return_value=False)

    from app.models.appointment import Appointment
    mock_appt = MagicMock(spec=Appointment)
    mock_appt.id = "appt-001"
    mock_appt.salon_id = "salon-unconnected"
    mock_appt.customer_id = "cust-001"
    mock_appt.customer_name = "Alice"
    mock_appt.customer_phone = "9876543210"
    mock_appt.start_datetime = None

    with patch("app.models.appointment.Appointment.find_one", AsyncMock(return_value=mock_appt)):
        with patch.object(service, "send_template_message", new_callable=AsyncMock) as mock_send_tpl:
            mock_send_tpl.return_value = MagicMock(status="SENT")

            log = await service.send_on_appointment_submit("507f1f77bcf86cd799439011")
            assert log is not None
            mock_send_tpl.assert_called_once()
            call_kwargs = mock_send_tpl.call_args.kwargs
            assert call_kwargs["salon_id"] == "salon-unconnected"
            assert call_kwargs["recipient_phone"] == "9876543210"
            assert call_kwargs["message_type"] == "APPOINTMENT_BOOKING"


# ==============================================================================
# TEST O: Existing per-salon architecture works in hybrid and salon modes
# ==============================================================================
@pytest.mark.asyncio
async def test_hybrid_and_salon_sender_modes(monkeypatch):
    service = WhatsAppService()

    connected_account = MagicMock(spec=SalonWhatsAppAccount)
    connected_account.status = "CONNECTED"
    connected_account.connection_status = "ACTIVE"
    connected_account.waba_id = "salon-waba-123"
    connected_account.phone_number_id = "salon-phone-123"
    connected_account.business_phone_number = "+919876543210"
    connected_account.authorization_data = {"access_token": "salon-token-123"}

    async def mock_get_account(s_id):
        if s_id == "connected-salon":
            return connected_account
        return None

    service.get_salon_account = AsyncMock(side_effect=mock_get_account)

    # 1. Hybrid mode: connected salon gets salon credentials
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "platform-phone")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "platform-token")
    hybrid_conn = await service.resolve_sender_credentials("connected-salon", sender_mode="hybrid")
    assert hybrid_conn.sender_type == "SALON"
    assert hybrid_conn.phone_number_id == "salon-phone-123"
    assert hybrid_conn.access_token == "salon-token-123"

    # 2. Hybrid mode: unconnected salon falls back to platform credentials
    hybrid_unconn = await service.resolve_sender_credentials("unconnected-salon", sender_mode="hybrid")
    assert hybrid_unconn.sender_type == "PLATFORM"
    assert hybrid_unconn.phone_number_id == "platform-phone"
    assert hybrid_unconn.access_token == "platform-token"

    # 3. Salon mode: unconnected salon returns invalid/None credentials (does not fall back)
    salon_unconn = await service.resolve_sender_credentials("unconnected-salon", sender_mode="salon")
    assert salon_unconn.sender_type == "SALON"
    assert salon_unconn.is_valid is False
    assert salon_unconn.phone_number_id is None
    assert salon_unconn.access_token is None
