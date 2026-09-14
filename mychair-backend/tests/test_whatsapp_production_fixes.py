import logging
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import pytest

from app.core.config import settings
from app.models.billing import Invoice
from app.models.appointment import Appointment
from app.models.whatsapp_message import WhatsAppMessageLog
from app.services.billing import BillingService
from app.services.whatsapp import WhatsAppService
from app.services.whatsapp.meta_provider import MetaCloudApiProvider, mask_phone_number


def make_mock_log(**kwargs):
    m = MagicMock(spec=WhatsAppMessageLog)
    for k, v in kwargs.items():
        setattr(m, k, v)
    m.status = kwargs.get("status", "SENT")
    m.id = kwargs.get("id", "log-mock-id")
    m.wamid = kwargs.get("wamid", "wamid.mock.123")
    m.insert = AsyncMock(return_value=m)
    m.save = AsyncMock(return_value=m)
    return m


# ==============================================================================
# 1 & 2: settings.WHATSAPP_TEMPLATE_LANGUAGE="en" results in Meta billing payload
#        "language": {"code": "en"} for service_completion_thank_you
# ==============================================================================
@pytest.mark.asyncio
async def test_billing_payload_language_code_en_service_completion_thank_you(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "123456789")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "mock-token-xyz")
    monkeypatch.setattr(settings, "WHATSAPP_TEMPLATE_LANGUAGE", "en")
    monkeypatch.setattr(settings, "WHATSAPP_BILLING_TEMPLATE", "service_completion_thank_you")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    captured_payload = {}
    mock_post_res = MagicMock()
    mock_post_res.status_code = 200
    mock_post_res.json.return_value = {
        "messaging_product": "whatsapp",
        "contacts": [{"input": "919876543210", "wa_id": "919876543210"}],
        "messages": [{"id": "wamid.billing.text.en"}],
    }

    async def fake_post(url, json=None, headers=None):
        nonlocal captured_payload
        captured_payload = json
        return mock_post_res

    billing_service = BillingService()
    invoice = MagicMock(spec=Invoice)
    invoice.id = "inv-lang-test-1"
    invoice.invoice_number = "INV-001"
    invoice.customer_name = "Jane Doe"
    invoice.customer_phone = "919876543210"
    invoice.salon_name = "Luxury Salon"
    invoice.total_amount = 1500.0

    with patch("httpx.AsyncClient.post", side_effect=fake_post), \
         patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=make_mock_log) as mock_log_cls:
        mock_log_cls.find_one = AsyncMock(return_value=None)

        log = await billing_service._dispatch_billing_whatsapp(
            salon_id="salon-lang-1",
            invoice=invoice,
            customer_id="cust-lang-1",
            customer_name="Jane Doe",
            customer_phone="919876543210",
            salon_name="Luxury Salon",
            send_whatsapp=True,
            send_bill_pdf=False,
        )

        assert log is not None
        assert captured_payload != {}
        assert captured_payload["template"]["name"] == "service_completion_thank_you"
        assert captured_payload["template"]["language"] == {"code": "en"}
        assert captured_payload["template"]["language"]["code"] == "en"


# ==============================================================================
# 3: settings.WHATSAPP_TEMPLATE_LANGUAGE="en" results in Meta billing payload
#    "language": {"code": "en"} for service_completion_thank_you_with_bill
# ==============================================================================
@pytest.mark.asyncio
async def test_billing_payload_language_code_en_service_completion_thank_you_with_bill(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "123456789")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "mock-token-xyz")
    monkeypatch.setattr(settings, "WHATSAPP_TEMPLATE_LANGUAGE", "en")
    monkeypatch.setattr(settings, "WHATSAPP_BILLING_PDF_TEMPLATE", "service_completion_thank_you_with_bill")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    captured_payload = {}
    mock_post_res = MagicMock()
    mock_post_res.status_code = 200
    mock_post_res.json.return_value = {
        "messaging_product": "whatsapp",
        "contacts": [{"input": "919876543210", "wa_id": "919876543210"}],
        "messages": [{"id": "wamid.billing.pdf.en"}],
    }

    async def fake_post(url, json=None, headers=None):
        nonlocal captured_payload
        captured_payload = json
        return mock_post_res

    billing_service = BillingService()
    invoice = MagicMock(spec=Invoice)
    invoice.id = "inv-lang-test-2"
    invoice.invoice_number = "INV-002"
    invoice.customer_name = "Jane Doe"
    invoice.customer_phone = "919876543210"
    invoice.salon_name = "Luxury Salon"
    invoice.total_amount = 2500.0

    with patch("httpx.AsyncClient.post", side_effect=fake_post), \
         patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=make_mock_log) as mock_log_cls, \
         patch("app.services.invoice_pdf.InvoicePDFService.ensure_invoice_pdf_url", AsyncMock(return_value="https://assets.mychair.co.in/invoices/INV-002.pdf")):
        mock_log_cls.find_one = AsyncMock(return_value=None)

        log = await billing_service._dispatch_billing_whatsapp(
            salon_id="salon-lang-1",
            invoice=invoice,
            customer_id="cust-lang-1",
            customer_name="Jane Doe",
            customer_phone="919876543210",
            salon_name="Luxury Salon",
            send_whatsapp=True,
            send_bill_pdf=True,
        )

        assert log is not None
        assert captured_payload != {}
        assert captured_payload["template"]["name"] == "service_completion_thank_you_with_bill"
        assert captured_payload["template"]["language"] == {"code": "en"}
        assert captured_payload["template"]["language"]["code"] == "en"

        # Check document header injection
        components = captured_payload["template"].get("components", [])
        has_doc_header = any(c.get("type") == "header" and c.get("parameters", [{}])[0].get("type") == "document" for c in components)
        assert has_doc_header is True


# ==============================================================================
# 4: No hardcoded en_US overrides the configured billing language
# ==============================================================================
@pytest.mark.asyncio
async def test_no_hardcoded_en_us_overrides_configured_billing_language(monkeypatch):
    # Test with custom configured language (e.g. "hi" for Hindi or "en_GB")
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "123456789")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "mock-token-xyz")
    monkeypatch.setattr(settings, "WHATSAPP_TEMPLATE_LANGUAGE", "hi")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    captured_payload = {}
    mock_post_res = MagicMock()
    mock_post_res.status_code = 200
    mock_post_res.json.return_value = {
        "messaging_product": "whatsapp",
        "contacts": [{"input": "919876543210", "wa_id": "919876543210"}],
        "messages": [{"id": "wamid.hi.123"}],
    }

    async def fake_post(url, json=None, headers=None):
        nonlocal captured_payload
        captured_payload = json
        return mock_post_res

    billing_service = BillingService()
    invoice = MagicMock(spec=Invoice)
    invoice.id = "inv-hi-1"
    invoice.invoice_number = "INV-003"
    invoice.customer_name = "Jane Doe"
    invoice.customer_phone = "919876543210"
    invoice.salon_name = "Luxury Salon"
    invoice.total_amount = 500.0

    with patch("httpx.AsyncClient.post", side_effect=fake_post), \
         patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=make_mock_log) as mock_log_cls:
        mock_log_cls.find_one = AsyncMock(return_value=None)

        await billing_service._dispatch_billing_whatsapp(
            salon_id="salon-lang-1",
            invoice=invoice,
            customer_id="cust-lang-1",
            customer_name="Jane Doe",
            customer_phone="919876543210",
            salon_name="Luxury Salon",
            send_whatsapp=True,
            send_bill_pdf=False,
        )

        assert captured_payload["template"]["language"]["code"] == "hi"
        assert captured_payload["template"]["language"]["code"] != "en_US"

        # Explicit language passed by caller overrides settings
        await billing_service._dispatch_billing_whatsapp(
            salon_id="salon-lang-1",
            invoice=invoice,
            customer_id="cust-lang-1",
            customer_name="Jane Doe",
            customer_phone="919876543210",
            salon_name="Luxury Salon",
            send_whatsapp=True,
            send_bill_pdf=False,
            language_code="es",
        )
        assert captured_payload["template"]["language"]["code"] == "es"


# ==============================================================================
# 5: Appointment flow with WHATSAPP_SENDER_MODE=platform and
#    WHATSAPP_APPOINTMENT_TEMPLATE=hello_world does NOT call Meta
# ==============================================================================
@pytest.mark.asyncio
async def test_appointment_flow_with_hello_world_in_platform_mode_does_not_call_meta(monkeypatch, caplog):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_APPOINTMENT_TEMPLATE", "hello_world")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=None)

    mock_appt = MagicMock(spec=Appointment)
    mock_appt.id = "appt-test-hw"
    mock_appt.salon_id = "salon-1"
    mock_appt.customer_id = "cust-1"
    mock_appt.customer_name = "Test Customer"
    mock_appt.customer_phone = "919876543210"
    mock_appt.start_datetime = datetime.now(timezone.utc)

    with patch("app.models.appointment.Appointment.find_one", AsyncMock(return_value=mock_appt)), \
         patch.object(service.provider, "send_template_message", new_callable=AsyncMock) as mock_provider_send:

        with caplog.at_level(logging.INFO, logger="whatsapp"):
            result = await service.send_on_appointment_submit("507f1f77bcf86cd799439011")

        # Must return None safely
        assert result is None

        # Must NEVER call Meta
        mock_provider_send.assert_not_called()

        # Must log the exact skip explanation
        assert any(
            "Appointment WhatsApp skipped: no production-approved appointment template configured" in r.message
            for r in caplog.records
        )


# ==============================================================================
# 6: Appointment creation still succeeds when hello_world is skipped
# ==============================================================================
@pytest.mark.asyncio
async def test_appointment_creation_succeeds_when_hello_world_skipped(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_APPOINTMENT_TEMPLATE", "hello_world")

    service = WhatsAppService()
    service.get_salon_account = AsyncMock(return_value=None)

    # Calling send_on_appointment_submit as a background task executes without raising
    mock_appt = MagicMock(spec=Appointment)
    mock_appt.id = "appt-creation-test"
    mock_appt.salon_id = "salon-1"
    mock_appt.customer_id = "cust-1"
    mock_appt.customer_name = "Frontdesk Client"
    mock_appt.customer_phone = "9876543210"
    mock_appt.start_datetime = datetime.now(timezone.utc)

    with patch("app.models.appointment.Appointment.find_one", AsyncMock(return_value=mock_appt)), \
         patch.object(service.provider, "send_template_message", new_callable=AsyncMock) as mock_meta:

        # Simulating background task execution
        result = await service.send_on_appointment_submit("507f1f77bcf86cd799439011")
        assert result is None
        mock_meta.assert_not_called()


# ==============================================================================
# 7: Billing WhatsApp is NOT skipped because of the appointment-template guard
# ==============================================================================
@pytest.mark.asyncio
async def test_billing_whatsapp_not_skipped_because_of_appointment_guard(monkeypatch):
    # Appointment template is hello_world, but billing template is service_completion_thank_you
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_APPOINTMENT_TEMPLATE", "hello_world")
    monkeypatch.setattr(settings, "WHATSAPP_BILLING_TEMPLATE", "service_completion_thank_you")
    monkeypatch.setattr(settings, "WHATSAPP_TEMPLATE_LANGUAGE", "en")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    billing_service = BillingService()
    invoice = MagicMock(spec=Invoice)
    invoice.id = "inv-guard-test"
    invoice.invoice_number = "INV-GUARD-01"
    invoice.customer_name = "Active Customer"
    invoice.customer_phone = "919876543210"
    invoice.salon_name = "MyChair Salon"
    invoice.total_amount = 1200.0

    mock_send_result = {
        "success": True,
        "wamid": "wamid.billing.not.skipped",
        "response_body": {},
    }

    with patch("app.services.whatsapp.meta_provider.MetaCloudApiProvider.send_template_message", AsyncMock(return_value=mock_send_result)) as mock_provider_send, \
         patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=make_mock_log) as mock_log_cls:
        mock_log_cls.find_one = AsyncMock(return_value=None)

        log = await billing_service._dispatch_billing_whatsapp(
            salon_id="salon-1",
            invoice=invoice,
            customer_id="cust-1",
            customer_name="Active Customer",
            customer_phone="919876543210",
            salon_name="MyChair Salon",
            send_whatsapp=True,
            send_bill_pdf=False,
        )

        assert log is not None
        mock_provider_send.assert_called_once()
        kwargs = mock_provider_send.call_args.kwargs
        assert kwargs["template_name"] == "service_completion_thank_you"
        assert kwargs["language_code"] == "en"


# ==============================================================================
# 8: Outbound log shows exact language and masked recipient before Meta POST
# ==============================================================================
@pytest.mark.asyncio
async def test_meta_provider_outbound_log_format_and_actual_language(caplog):
    caplog.set_level(logging.INFO, logger="whatsapp.meta")

    provider = MetaCloudApiProvider(api_version="v20.0")
    mock_res = MagicMock()
    mock_res.status_code = 200
    mock_res.json.return_value = {
        "messaging_product": "whatsapp",
        "contacts": [{"input": "919876543210", "wa_id": "919876543210"}],
        "messages": [{"id": "wamid.outbound.log"}],
    }

    with patch("httpx.AsyncClient.post", AsyncMock(return_value=mock_res)):
        await provider.send_template_message(
            phone_number_id="phone-id-555",
            access_token="super-secret-token",
            to_phone="919876543210",
            template_name="service_completion_thank_you",
            language_code="en",
        )

    outbound_logs = [r.message for r in caplog.records if "[Meta Cloud API] Outbound template send" in r.message]
    assert len(outbound_logs) == 1
    log = outbound_logs[0]

    assert "to=9198******10" in log
    assert "template=service_completion_thank_you" in log
    assert "language=en" in log
    assert "phone_id=phone-id-555" in log
    # Crucial: raw token and unmasked phone NEVER appear in log
    assert "super-secret-token" not in log
    assert "919876543210" not in log
