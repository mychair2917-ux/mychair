import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone

from app.core.config import settings
from app.models.billing import Invoice, Payment
from app.models.whatsapp_message import WhatsAppMessageLog
from app.schemas.appointment import FrontDeskAppointmentCreate
from app.schemas.billing import InvoiceCreate
from app.services.billing import BillingService
from app.services.whatsapp import WhatsAppService


def make_mock_log(**kwargs):
    """Instantiate mock WhatsAppMessageLog capturing all attributes."""
    m = MagicMock(spec=WhatsAppMessageLog)
    for k, v in kwargs.items():
        setattr(m, k, v)
    m.insert = AsyncMock()
    m.save = AsyncMock()
    return m


# ==============================================================================
# TEST 1: Schema Normalization & Defaults
# ==============================================================================
def test_schema_defaults_and_normalization():
    """Validates default values and normalization of invalid combinations."""
    # FrontDeskAppointmentCreate defaults
    appt_payload = FrontDeskAppointmentCreate(
        salon_id="salon-1",
        customer_id="cust-1",
        start_datetime=datetime.now(timezone.utc),
        services=[{"service_id": "s1", "price": 100.0, "staff_id": "staff-1"}],
        payment_type="CASH",
        payment_status="PAID",
        total_amount=100.0,
    )
    assert appt_payload.send_whatsapp is False
    assert appt_payload.send_bill_pdf is False

    # Normalize invalid combination (send_whatsapp=False, send_bill_pdf=True)
    appt_invalid = FrontDeskAppointmentCreate(
        salon_id="salon-1",
        customer_id="cust-1",
        start_datetime=datetime.now(timezone.utc),
        services=[{"service_id": "s1", "price": 100.0, "staff_id": "staff-1"}],
        payment_type="CASH",
        payment_status="PAID",
        total_amount=100.0,
        send_whatsapp=False,
        send_bill_pdf=True,
    )
    assert appt_invalid.send_whatsapp is False
    assert appt_invalid.send_bill_pdf is False

    # InvoiceCreate defaults
    inv_payload = InvoiceCreate(
        salon_id="salon-1",
        customer_id="cust-1",
        items=[{"item_type": "SERVICE", "item_id": "s1", "name": "Cut", "unit_price": 100.0}],
    )
    assert inv_payload.send_whatsapp is False
    assert inv_payload.send_bill_pdf is False

    # InvoiceCreate normalization
    inv_invalid = InvoiceCreate(
        salon_id="salon-1",
        customer_id="cust-1",
        items=[{"item_type": "SERVICE", "item_id": "s1", "name": "Cut", "unit_price": 100.0}],
        send_whatsapp=False,
        send_bill_pdf=True,
    )
    assert inv_invalid.send_whatsapp is False
    assert inv_invalid.send_bill_pdf is False


# ==============================================================================
# TEST 2: send_whatsapp=False -> No WhatsApp API call
# ==============================================================================
@pytest.mark.asyncio
async def test_send_whatsapp_false_makes_no_api_call(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    billing_service = BillingService()
    billing_service._generate_invoice_number = AsyncMock(return_value="INV-NO-WHATSAPP-01")
    billing_service.inventory_service = MagicMock()
    billing_service.inventory_service.deduct_sold_product = AsyncMock()

    mock_invoice = MagicMock()
    mock_invoice.id = "inv-no-wa"
    mock_invoice.status = "FINALIZED"
    mock_invoice.invoice_number = "INV-NO-WHATSAPP-01"
    mock_invoice.total_amount = 300.0
    mock_invoice.insert = AsyncMock()

    mock_payment = MagicMock()
    mock_payment.insert = AsyncMock()

    with patch("app.services.billing.Invoice") as mock_invoice_cls, \
         patch("app.services.billing.Payment") as mock_payment_cls, \
         patch("app.services.whatsapp.whatsapp_service.send_template_message", new_callable=AsyncMock) as mock_send:
        mock_invoice_cls.return_value = mock_invoice
        mock_invoice_cls.find_one = AsyncMock(return_value=None)
        mock_payment_cls.return_value = mock_payment

        invoice = await billing_service.create_invoice_from_appointment(
            salon_id="salon-123",
            appointment_id="appt-123",
            salon_name="Looks Salon",
            salon_phone="9876543210",
            salon_address="MG Road",
            customer_id="cust-123",
            customer_name="Rohan Verma",
            customer_phone="9876543210",
            services=[{"service_id": "s1", "name": "Haircut", "price": 300.0}],
            products=[],
            payment_status="PAID",
            payment_method="CASH",
            total_amount=300.0,
            paid_amount=300.0,
            send_whatsapp=False,
            send_bill_pdf=False,
        )

        assert invoice is not None
        mock_send.assert_not_called()


# ==============================================================================
# TEST 3: send_whatsapp=True + send_bill_pdf=False -> text-only template (no PDF)
# ==============================================================================
@pytest.mark.asyncio
async def test_send_whatsapp_text_only_template_selection(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_BILLING_TEMPLATE", "service_completion_thank_you")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    billing_service = BillingService()
    billing_service._generate_invoice_number = AsyncMock(return_value="INV-TEXT-01")
    billing_service.inventory_service = MagicMock()
    billing_service.inventory_service.deduct_sold_product = AsyncMock()

    mock_invoice = MagicMock()
    mock_invoice.id = "inv-text-01"
    mock_invoice.status = "FINALIZED"
    mock_invoice.invoice_number = "INV-TEXT-01"
    mock_invoice.total_amount = 600.0
    mock_invoice.insert = AsyncMock()

    mock_payment = MagicMock()
    mock_payment.insert = AsyncMock()

    actual_client = "Amit Sharma"
    actual_salon = "Looks Salon Pune"

    with patch("app.services.billing.Invoice") as mock_invoice_cls, \
         patch("app.services.billing.Payment") as mock_payment_cls, \
         patch("app.services.whatsapp.whatsapp_service.send_template_message", new_callable=AsyncMock) as mock_send:
        mock_invoice_cls.return_value = mock_invoice
        mock_invoice_cls.find_one = AsyncMock(return_value=None)
        mock_payment_cls.return_value = mock_payment

        invoice = await billing_service.create_invoice_from_appointment(
            salon_id="salon-pune-1",
            appointment_id="appt-pune-1",
            salon_name=actual_salon,
            salon_phone="9876543210",
            salon_address="FC Road",
            customer_id="cust-amit-1",
            customer_name=actual_client,
            customer_phone="9876543210",
            services=[{"service_id": "s1", "name": "Facial", "price": 600.0}],
            products=[],
            payment_status="PAID",
            payment_method="UPI",
            total_amount=600.0,
            paid_amount=600.0,
            send_whatsapp=True,
            send_bill_pdf=False,
        )

        assert invoice is not None
        mock_send.assert_called_once()
        kwargs = mock_send.call_args.kwargs

        # Template name must be text-only template
        assert kwargs["template_name"] == "service_completion_thank_you"
        assert kwargs["attachment_type"] == "NONE"

        # Named variables
        tpl_vars = kwargs["template_variables"]
        assert tpl_vars["client_name"] == actual_client
        assert tpl_vars["salon_name"] == actual_salon
        assert tpl_vars["salon_name_repeat"] == actual_salon  # Exactly matches salon_name

        # Components: must NOT contain document header component
        components = kwargs["components"]
        assert components is not None
        assert not any(c.get("type") == "header" for c in components)
        assert any(c.get("type") == "body" for c in components)


# ==============================================================================
# TEST 4: send_whatsapp=True + send_bill_pdf=True -> PDF template with document HEADER
# ==============================================================================
@pytest.mark.asyncio
async def test_send_whatsapp_with_bill_pdf_template_selection(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_BILLING_PDF_TEMPLATE", "service_completion_thank_you_with_bill")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    billing_service = BillingService()
    billing_service._generate_invoice_number = AsyncMock(return_value="INV-PDF-99")
    billing_service.inventory_service = MagicMock()
    billing_service.inventory_service.deduct_sold_product = AsyncMock()

    mock_invoice = MagicMock()
    mock_invoice.id = "inv-pdf-99"
    mock_invoice.status = "FINALIZED"
    mock_invoice.invoice_number = "INV-PDF-99"
    mock_invoice.total_amount = 1250.0
    mock_invoice.insert = AsyncMock()

    mock_payment = MagicMock()
    mock_payment.insert = AsyncMock()

    actual_client = "Priya Patel"
    actual_salon = "Enrich Salon Mumbai"
    expected_pdf_url = "https://mychair.co.in/static/invoices/INV-PDF-99-inv-pdf-99.pdf"

    with patch("app.services.billing.Invoice") as mock_invoice_cls, \
         patch("app.services.billing.Payment") as mock_payment_cls, \
         patch("app.services.invoice_pdf.InvoicePDFService.ensure_invoice_pdf_url", new_callable=AsyncMock) as mock_ensure_pdf, \
         patch("app.services.whatsapp.whatsapp_service.send_template_message", new_callable=AsyncMock) as mock_send:
        mock_invoice_cls.return_value = mock_invoice
        mock_invoice_cls.find_one = AsyncMock(return_value=None)
        mock_payment_cls.return_value = mock_payment
        mock_ensure_pdf.return_value = expected_pdf_url

        invoice = await billing_service.create_invoice_from_appointment(
            salon_id="salon-mumbai-1",
            appointment_id="appt-mumbai-1",
            salon_name=actual_salon,
            salon_phone="9876543210",
            salon_address="Bandra West",
            customer_id="cust-priya-1",
            customer_name=actual_client,
            customer_phone="9876543210",
            services=[{"service_id": "s1", "name": "Coloring", "price": 1250.0}],
            products=[],
            payment_status="PAID",
            payment_method="CARD",
            total_amount=1250.0,
            paid_amount=1250.0,
            send_whatsapp=True,
            send_bill_pdf=True,
        )

        assert invoice is not None
        mock_ensure_pdf.assert_called_once_with(mock_invoice)
        mock_send.assert_called_once()
        kwargs = mock_send.call_args.kwargs

        # Template name must be PDF template
        assert kwargs["template_name"] == "service_completion_thank_you_with_bill"
        assert kwargs["attachment_type"] == "BILL_PDF"

        # Named variables
        tpl_vars = kwargs["template_variables"]
        assert tpl_vars["client_name"] == actual_client
        assert tpl_vars["salon_name"] == actual_salon
        assert tpl_vars["salon_name_repeat"] == actual_salon

        # Components: MUST contain document header component
        components = kwargs["components"]
        assert components is not None
        header_comp = next((c for c in components if c.get("type") == "header"), None)
        assert header_comp is not None

        params = header_comp["parameters"]
        assert len(params) == 1
        assert params[0]["type"] == "document"
        assert params[0]["document"]["link"] == expected_pdf_url
        assert params[0]["document"]["filename"] == "INV-PDF-99.pdf"

        # Body component also present
        body_comp = next((c for c in components if c.get("type") == "body"), None)
        assert body_comp is not None


# ==============================================================================
# TEST 5: MetaCloudApiProvider passes document header cleanly
# ==============================================================================
@pytest.mark.asyncio
async def test_meta_provider_formats_document_header_payload():
    from app.services.whatsapp.meta_provider import MetaCloudApiProvider

    provider = MetaCloudApiProvider()

    components = [
        {
            "type": "header",
            "parameters": [
                {
                    "type": "document",
                    "document": {
                        "link": "https://mychair.co.in/static/invoices/INV-101.pdf",
                        "filename": "INV-101.pdf",
                    },
                }
            ],
        },
        {
            "type": "body",
            "parameters": [
                {"type": "text", "parameter_name": "client_name", "text": "Customer A"},
                {"type": "text", "parameter_name": "salon_name", "text": "Salon B"},
                {"type": "text", "parameter_name": "salon_name_repeat", "text": "Salon B"},
            ],
        },
    ]

    with patch("httpx.AsyncClient.post", new_callable=AsyncMock) as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {"messages": [{"id": "wamid.header.doc.123"}]}
        mock_post.return_value = mock_resp

        res = await provider.send_template_message(
            phone_number_id="phone-id-123",
            access_token="token-abc",
            to_phone="919876543210",
            template_name="service_completion_thank_you_with_bill",
            components=components,
        )

        assert res["success"] is True
        assert res["wamid"] == "wamid.header.doc.123"

        # Verify sent JSON payload
        mock_post.assert_called_once()
        sent_json = mock_post.call_args.kwargs["json"]
        assert sent_json["template"]["name"] == "service_completion_thank_you_with_bill"
        sent_components = sent_json["template"]["components"]
        assert len(sent_components) == 2
        assert sent_components[0]["type"] == "header"
        assert sent_components[0]["parameters"][0]["type"] == "document"
        assert sent_components[0]["parameters"][0]["document"]["link"] == "https://mychair.co.in/static/invoices/INV-101.pdf"


# ==============================================================================
# TEST 6: WhatsApp failure never affects billing success
# ==============================================================================
@pytest.mark.asyncio
async def test_whatsapp_failure_does_not_fail_billing(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    billing_service = BillingService()
    billing_service._generate_invoice_number = AsyncMock(return_value="INV-SAFE-01")
    billing_service.inventory_service = MagicMock()
    billing_service.inventory_service.deduct_sold_product = AsyncMock()

    mock_invoice = MagicMock()
    mock_invoice.id = "inv-safe-01"
    mock_invoice.status = "FINALIZED"
    mock_invoice.invoice_number = "INV-SAFE-01"
    mock_invoice.total_amount = 500.0
    mock_invoice.insert = AsyncMock()

    mock_payment = MagicMock()
    mock_payment.insert = AsyncMock()

    with patch("app.services.billing.Invoice") as mock_invoice_cls, \
         patch("app.services.billing.Payment") as mock_payment_cls, \
         patch("app.services.whatsapp.whatsapp_service.send_template_message", AsyncMock(side_effect=RuntimeError("Meta Graph API 500 Fatal"))):
        mock_invoice_cls.return_value = mock_invoice
        mock_invoice_cls.find_one = AsyncMock(return_value=None)
        mock_payment_cls.return_value = mock_payment

        invoice = await billing_service.create_invoice_from_appointment(
            salon_id="salon-123",
            appointment_id="appt-123",
            salon_name="Salon Test",
            salon_phone="9876543210",
            salon_address="Test Addr",
            customer_id="cust-123",
            customer_name="Client Test",
            customer_phone="9876543210",
            services=[],
            products=[],
            payment_status="PAID",
            payment_method="CASH",
            total_amount=500.0,
            paid_amount=500.0,
            send_whatsapp=True,
            send_bill_pdf=True,
        )

        # Invoice and payment MUST remain completely finalized and valid
        assert invoice is not None
        assert invoice.status == "FINALIZED"


# ==============================================================================
# TEST 7: Deduplication key prevents duplicate WhatsApp message sends
# ==============================================================================
@pytest.mark.asyncio
async def test_deduplication_key_prevents_duplicate_sends(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    mock_provider = MagicMock()
    mock_provider.send_template_message = AsyncMock()
    service.provider = mock_provider

    existing_log = make_mock_log(
        id="existing-log-1",
        status="SENT",
        deduplication_key="salon-1:BILL:inv-123:BILL_RECEIPT",
    )

    with patch("app.models.whatsapp_message.WhatsAppMessageLog.find_one", AsyncMock(return_value=existing_log)):
        log = await service.send_template_message(
            salon_id="salon-1",
            customer_id="cust-1",
            recipient_phone="9876543210",
            message_type="BILL_RECEIPT",
            template_name="service_completion_thank_you",
            reference_type="BILL",
            reference_id="inv-123",
        )

        assert log == existing_log
        mock_provider.send_template_message.assert_not_called()


# ==============================================================================
# TEST 8: Invalid customer phone gracefully skips WhatsApp without failing billing
# ==============================================================================
@pytest.mark.asyncio
async def test_invalid_customer_phone_skips_cleanly(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    billing_service = BillingService()
    billing_service._generate_invoice_number = AsyncMock(return_value="INV-INVALID-PHONE")
    billing_service.inventory_service = MagicMock()
    billing_service.inventory_service.deduct_sold_product = AsyncMock()

    mock_invoice = MagicMock()
    mock_invoice.id = "inv-inv-phone"
    mock_invoice.status = "FINALIZED"
    mock_invoice.invoice_number = "INV-INVALID-PHONE"
    mock_invoice.total_amount = 200.0
    mock_invoice.insert = AsyncMock()

    mock_payment = MagicMock()
    mock_payment.insert = AsyncMock()

    # Pass customer_phone as a client ID 'CL-00123' which is not a valid phone number
    with patch("app.services.billing.Invoice") as mock_invoice_cls, \
         patch("app.services.billing.Payment") as mock_payment_cls, \
         patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=make_mock_log) as mock_log_cls, \
         patch("app.services.whatsapp.meta_provider.MetaCloudApiProvider.send_template_message", new_callable=AsyncMock) as mock_meta_send:
        mock_invoice_cls.return_value = mock_invoice
        mock_invoice_cls.find_one = AsyncMock(return_value=None)
        mock_payment_cls.return_value = mock_payment
        mock_log_cls.find_one = AsyncMock(return_value=None)

        invoice = await billing_service.create_invoice_from_appointment(
            salon_id="salon-123",
            appointment_id="appt-123",
            salon_name="Looks Salon",
            salon_phone="9876543210",
            salon_address="FC Road",
            customer_id="cust-123",
            customer_name="Client With Bad Phone",
            customer_phone="CL-00123",  # Client ID instead of phone
            services=[],
            products=[],
            payment_status="PAID",
            payment_method="CASH",
            total_amount=200.0,
            paid_amount=200.0,
            send_whatsapp=True,
            send_bill_pdf=False,
        )

        assert invoice is not None
        assert invoice.status == "FINALIZED"
        # Meta provider must not be called with an invalid phone number
        mock_meta_send.assert_not_called()


# ==============================================================================
# TEST 9: Customer opt-out skips WhatsApp send cleanly
# ==============================================================================
@pytest.mark.asyncio
async def test_customer_opt_out_skips_whatsapp(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    mock_provider = MagicMock()
    mock_provider.send_template_message = AsyncMock()
    service.provider = mock_provider

    with patch.object(service, "check_customer_opt_in", AsyncMock(return_value=False)), \
         patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=make_mock_log) as mock_log_cls:
        mock_log_cls.find_one = AsyncMock(return_value=None)

        log = await service.send_template_message(
            salon_id="salon-1",
            customer_id="cust-optout",
            recipient_phone="9876543210",
            message_type="BILL_RECEIPT",
            template_name="service_completion_thank_you",
            reference_type="BILL",
            reference_id="inv-optout",
        )

        assert log.status == "CANCELLED"
        assert "opted out" in log.error_message
        mock_provider.send_template_message.assert_not_called()


