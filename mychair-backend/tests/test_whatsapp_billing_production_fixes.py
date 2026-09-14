import pytest
import logging
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta

from app.core.config import settings
from app.models.billing import Invoice
from app.models.whatsapp_message import WhatsAppMessageLog
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
# TEST A: A BILL message stores BOTH invoice_id and bill_id
# ==============================================================================
@pytest.mark.asyncio
async def test_a_bill_message_stores_both_invoice_id_and_bill_id(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    mock_provider = MagicMock()
    mock_provider.send_template_message = AsyncMock(return_value={
        "success": True,
        "wamid": "wamid.test.dual.123",
        "response_body": {},
    })
    service.provider = mock_provider

    saved_logs = []

    def mock_init(*args, **kwargs):
        log_mock = make_mock_log(**kwargs)
        saved_logs.append(log_mock)
        return log_mock

    with patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=mock_init) as mock_cls:
        mock_cls.find_one = AsyncMock(return_value=None)

        log = await service.send_template_message(
            salon_id="salon-1",
            customer_id="cust-1",
            recipient_phone="9876543210",
            message_type="BILL_RECEIPT",
            template_name="service_completion_thank_you",
            reference_type="BILL",
            reference_id="inv-dual-123",
        )

        assert len(saved_logs) >= 1
        sending_log = saved_logs[0]
        assert sending_log.invoice_id == "inv-dual-123"
        assert sending_log.bill_id == "inv-dual-123"


# ==============================================================================
# TEST B: latest_statuses_for_invoices finds old records containing only bill_id
# ==============================================================================
@pytest.mark.asyncio
async def test_b_latest_statuses_for_invoices_finds_legacy_bill_id():
    service = WhatsAppService()

    old_log = make_mock_log(
        id="old-log-1",
        invoice_id=None,
        bill_id="inv-legacy-999",
        delivery_status="sent",
        status="SENT",
    )

    with patch("app.services.whatsapp.service.WhatsAppMessageLog.find") as mock_find:
        mock_find.return_value.sort.return_value.to_list = AsyncMock(return_value=[old_log])

        statuses = await service.latest_statuses_for_invoices(["inv-legacy-999"])
        assert "inv-legacy-999" in statuses
        assert statuses["inv-legacy-999"] == "sent"

    with patch("app.services.whatsapp.service.WhatsAppMessageLog.find") as mock_find:
        mock_find.return_value.sort.return_value.first_or_none = AsyncMock(return_value=old_log)

        single_status = await service.latest_status_for_invoice("inv-legacy-999")
        assert single_status == "sent"


# ==============================================================================
# TEST C: latest_statuses_for_invoices finds new records containing invoice_id
# ==============================================================================
@pytest.mark.asyncio
async def test_c_latest_statuses_for_invoices_finds_new_invoice_id():
    service = WhatsAppService()

    new_log = make_mock_log(
        id="new-log-1",
        invoice_id="inv-new-555",
        bill_id="inv-new-555",
        delivery_status="delivered",
        status="SENT",
    )

    with patch("app.services.whatsapp.service.WhatsAppMessageLog.find") as mock_find:
        mock_find.return_value.sort.return_value.to_list = AsyncMock(return_value=[new_log])

        statuses = await service.latest_statuses_for_invoices(["inv-new-555"])
        assert "inv-new-555" in statuses
        assert statuses["inv-new-555"] == "delivered"


# ==============================================================================
# TEST D: SENT billing message displays sent, not pending
# ==============================================================================
def test_d_sent_billing_message_displays_sent_not_pending():
    service = WhatsAppService()
    assert service.normalize_ui_status("SENT") == "sent"
    assert service.normalize_ui_status("sent") == "sent"


# ==============================================================================
# TEST E: FAILED billing message displays failed, not pending
# ==============================================================================
def test_e_failed_billing_message_displays_failed_not_pending():
    service = WhatsAppService()
    assert service.normalize_ui_status("FAILED") == "failed"
    assert service.normalize_ui_status("failed") == "failed"
    assert service.normalize_ui_status("CANCELLED") == "failed"


# ==============================================================================
# TEST F: Billing existing appointment through update_invoice_from_appointment() sends WhatsApp when send_whatsapp=true
# ==============================================================================
@pytest.mark.asyncio
async def test_f_update_invoice_from_appointment_sends_whatsapp_when_true(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_BILLING_TEMPLATE", "service_completion_thank_you")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    billing_service = BillingService()

    mock_existing_invoice = MagicMock(spec=Invoice)
    mock_existing_invoice.id = "inv-exist-123"
    mock_existing_invoice.invoice_number = "INV-2026-EX1"
    mock_existing_invoice.salon_name = "Glam Salon"
    mock_existing_invoice.customer_name = "Ravi Kumar"
    mock_existing_invoice.customer_phone = "9876543210"
    mock_existing_invoice.total_amount = 500.0
    mock_existing_invoice.save = AsyncMock()

    with patch("app.services.billing.Invoice.find_one", AsyncMock(return_value=mock_existing_invoice)), \
         patch("app.services.whatsapp.whatsapp_service.send_template_message", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = make_mock_log(status="SENT")

        invoice = await billing_service.update_invoice_from_appointment(
            appointment_id="appt-exist-123",
            salon_id="salon-1",
            salon_name="Glam Salon",
            salon_phone="9876543210",
            salon_address="Main St",
            customer_id="cust-ravi-1",
            customer_name="Ravi Kumar",
            customer_phone="9876543210",
            services=[{"service_id": "s1", "name": "Haircut", "price": 500.0}],
            products=[],
            payment_status="PAID",
            payment_method="CASH",
            total_amount=500.0,
            paid_amount=500.0,
            send_whatsapp=True,
            send_bill_pdf=False,
        )

        assert invoice is not None
        mock_send.assert_called_once()
        kwargs = mock_send.call_args.kwargs
        assert kwargs["template_name"] == "service_completion_thank_you"
        assert kwargs["reference_type"] == "BILL"
        assert kwargs["reference_id"] == "inv-exist-123"
        assert kwargs["recipient_phone"] == "9876543210"


# ==============================================================================
# TEST G: Existing appointment does not send WhatsApp when send_whatsapp=false
# ==============================================================================
@pytest.mark.asyncio
async def test_g_update_invoice_from_appointment_skips_whatsapp_when_false(monkeypatch):
    billing_service = BillingService()

    mock_existing_invoice = MagicMock(spec=Invoice)
    mock_existing_invoice.id = "inv-exist-456"
    mock_existing_invoice.save = AsyncMock()

    with patch("app.services.billing.Invoice.find_one", AsyncMock(return_value=mock_existing_invoice)), \
         patch("app.services.whatsapp.whatsapp_service.send_template_message", new_callable=AsyncMock) as mock_send:

        invoice = await billing_service.update_invoice_from_appointment(
            appointment_id="appt-exist-456",
            salon_id="salon-1",
            salon_name="Glam Salon",
            salon_phone="9876543210",
            salon_address="Main St",
            customer_id="cust-1",
            customer_name="Customer 1",
            customer_phone="9876543210",
            services=[],
            products=[],
            payment_status="PAID",
            payment_method="CASH",
            total_amount=100.0,
            paid_amount=100.0,
            send_whatsapp=False,
            send_bill_pdf=False,
        )

        assert invoice is not None
        mock_send.assert_not_called()


# ==============================================================================
# TEST H: PDF selection still uses the PDF template
# ==============================================================================
@pytest.mark.asyncio
async def test_h_pdf_selection_uses_pdf_template(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_BILLING_PDF_TEMPLATE", "service_completion_thank_you_with_bill")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    billing_service = BillingService()

    mock_existing_invoice = MagicMock(spec=Invoice)
    mock_existing_invoice.id = "inv-pdf-1"
    mock_existing_invoice.invoice_number = "INV-PDF-001"
    mock_existing_invoice.customer_phone = "9876543210"
    mock_existing_invoice.total_amount = 1500.0
    mock_existing_invoice.save = AsyncMock()

    with patch("app.services.billing.Invoice.find_one", AsyncMock(return_value=mock_existing_invoice)), \
         patch("app.services.invoice_pdf.InvoicePDFService.ensure_invoice_pdf_url", AsyncMock(return_value="https://mychair.co.in/invoices/inv-pdf-1.pdf")), \
         patch("app.services.whatsapp.whatsapp_service.send_template_message", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = make_mock_log(status="SENT")

        invoice = await billing_service.update_invoice_from_appointment(
            appointment_id="appt-pdf-1",
            salon_id="salon-1",
            salon_name="Glam Salon",
            salon_phone="9876543210",
            salon_address="Main St",
            customer_id="cust-1",
            customer_name="Client Name",
            customer_phone="9876543210",
            services=[],
            products=[],
            payment_status="PAID",
            payment_method="CASH",
            total_amount=1500.0,
            paid_amount=1500.0,
            send_whatsapp=True,
            send_bill_pdf=True,
        )

        assert invoice is not None
        mock_send.assert_called_once()
        kwargs = mock_send.call_args.kwargs
        assert kwargs["template_name"] == "service_completion_thank_you_with_bill"
        assert kwargs["attachment_type"] == "BILL_PDF"


# ==============================================================================
# TEST I: Text-only selection uses the text template
# ==============================================================================
@pytest.mark.asyncio
async def test_i_text_only_selection_uses_text_template(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_BILLING_TEMPLATE", "service_completion_thank_you")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    billing_service = BillingService()

    mock_existing_invoice = MagicMock(spec=Invoice)
    mock_existing_invoice.id = "inv-text-1"
    mock_existing_invoice.invoice_number = "INV-TXT-001"
    mock_existing_invoice.customer_phone = "9876543210"
    mock_existing_invoice.total_amount = 300.0
    mock_existing_invoice.save = AsyncMock()

    with patch("app.services.billing.Invoice.find_one", AsyncMock(return_value=mock_existing_invoice)), \
         patch("app.services.whatsapp.whatsapp_service.send_template_message", new_callable=AsyncMock) as mock_send:
        mock_send.return_value = make_mock_log(status="SENT")

        invoice = await billing_service.update_invoice_from_appointment(
            appointment_id="appt-txt-1",
            salon_id="salon-1",
            salon_name="Glam Salon",
            salon_phone="9876543210",
            salon_address="Main St",
            customer_id="cust-1",
            customer_name="Client Name",
            customer_phone="9876543210",
            services=[],
            products=[],
            payment_status="PAID",
            payment_method="CASH",
            total_amount=300.0,
            paid_amount=300.0,
            send_whatsapp=True,
            send_bill_pdf=False,
        )

        assert invoice is not None
        mock_send.assert_called_once()
        kwargs = mock_send.call_args.kwargs
        assert kwargs["template_name"] == "service_completion_thank_you"
        assert kwargs["attachment_type"] == "NONE"


# ==============================================================================
# TEST J: Unexpected provider exception marks WhatsAppMessageLog FAILED
# ==============================================================================
@pytest.mark.asyncio
async def test_j_unexpected_provider_exception_marks_log_failed(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    mock_provider = MagicMock()
    mock_provider.send_template_message = AsyncMock(side_effect=RuntimeError("Connection reset by peer"))
    service.provider = mock_provider

    saved_logs = []

    def mock_init(*args, **kwargs):
        log_mock = make_mock_log(**kwargs)
        saved_logs.append(log_mock)
        return log_mock

    with patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=mock_init) as mock_cls:
        mock_cls.find_one = AsyncMock(return_value=None)

        log = await service.send_template_message(
            salon_id="salon-1",
            customer_id="cust-1",
            recipient_phone="9876543210",
            message_type="BILL_RECEIPT",
            template_name="service_completion_thank_you",
            reference_type="BILL",
            reference_id="inv-fail-exc-1",
        )

        assert log.status == "FAILED"
        assert log.delivery_status == "failed"
        assert log.failed_at is not None
        assert "Connection reset by peer" in log.error_message
        log.save.assert_called()


# ==============================================================================
# TEST K: Stale SENDING without wamid can recover/retry safely
# ==============================================================================
@pytest.mark.asyncio
async def test_k_stale_sending_without_wamid_recovers_safely(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    mock_provider = MagicMock()
    mock_provider.send_template_message = AsyncMock(return_value={
        "success": True,
        "wamid": "wamid.retry.success.123",
        "response_body": {},
    })
    service.provider = mock_provider

    # Stale record created 20 minutes ago without wamid
    stale_log = make_mock_log(
        id="stale-log-1",
        status="SENDING",
        delivery_status=None,
        wamid=None,
        meta_message_id=None,
        created_at=datetime.now(timezone.utc) - timedelta(minutes=20),
        deduplication_key="salon-1:BILL:inv-stale-1:BILL_RECEIPT",
    )

    new_log_instance = make_mock_log(
        status="SENDING",
        deduplication_key="salon-1:BILL:inv-stale-1:BILL_RECEIPT",
    )

    with patch("app.services.whatsapp.service.WhatsAppMessageLog", return_value=new_log_instance) as mock_cls:
        mock_cls.find_one = AsyncMock(return_value=stale_log)
        mock_cls.find.return_value.update = AsyncMock(return_value=MagicMock(modified_count=1))

        log = await service.send_template_message(
            salon_id="salon-1",
            customer_id="cust-1",
            recipient_phone="9876543210",
            message_type="BILL_RECEIPT",
            template_name="service_completion_thank_you",
            reference_type="BILL",
            reference_id="inv-stale-1",
        )

        # Atomic claim filter was invoked with correct conditions
        mock_cls.find.assert_called_once()
        claim_filter = mock_cls.find.call_args[0][0]
        assert claim_filter["_id"] == "stale-log-1"
        assert claim_filter["status"] == "SENDING"
        assert claim_filter["wamid"] == {"$in": [None, ""]}
        assert claim_filter["meta_message_id"] == {"$in": [None, ""]}
        assert "created_at" in claim_filter
        assert "$lte" in claim_filter["created_at"]
        assert claim_filter["is_deleted"] is False

        # Stale log was transitioned to FAILED
        assert stale_log.status == "FAILED"
        assert stale_log.error_message == "STALE_SENDING_RECOVERED"

        # Provider was called for the retry
        mock_provider.send_template_message.assert_called_once()
        assert log.status == "SENT"


# ==============================================================================
# TEST L: SENDING with wamid is NOT blindly resent
# ==============================================================================
@pytest.mark.asyncio
async def test_l_sending_with_wamid_is_not_resent(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    mock_provider = MagicMock()
    mock_provider.send_template_message = AsyncMock()
    service.provider = mock_provider

    # In-flight record that already has a Meta wamid
    dispatched_log = make_mock_log(
        id="dispatched-log-1",
        status="SENDING",
        wamid="wamid.already.dispatched.999",
        created_at=datetime.now(timezone.utc) - timedelta(minutes=20),
        deduplication_key="salon-1:BILL:inv-dispatched-1:BILL_RECEIPT",
    )

    with patch("app.services.whatsapp.service.WhatsAppMessageLog.find_one", AsyncMock(return_value=dispatched_log)):
        log = await service.send_template_message(
            salon_id="salon-1",
            customer_id="cust-1",
            recipient_phone="9876543210",
            message_type="BILL_RECEIPT",
            template_name="service_completion_thank_you",
            reference_type="BILL",
            reference_id="inv-dispatched-1",
        )

        # Should NOT resend
        mock_provider.send_template_message.assert_not_called()
        assert log == dispatched_log


# ==============================================================================
# TEST M: WHATSAPP_TEMPLATE_LANGUAGE is passed to Meta
# ==============================================================================
@pytest.mark.asyncio
async def test_m_whatsapp_template_language_passed_to_meta(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEMPLATE_LANGUAGE", "en")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    service = WhatsAppService()
    mock_provider = MagicMock()
    mock_provider.send_template_message = AsyncMock(return_value={
        "success": True,
        "wamid": "wamid.lang.123",
        "response_body": {},
    })
    service.provider = mock_provider

    with patch("app.services.whatsapp.service.WhatsAppMessageLog", side_effect=make_mock_log) as mock_cls:
        mock_cls.find_one = AsyncMock(return_value=None)

        await service.send_template_message(
            salon_id="salon-1",
            customer_id="cust-1",
            recipient_phone="9876543210",
            message_type="BILL_RECEIPT",
            template_name="service_completion_thank_you",
            reference_type="BILL",
            reference_id="inv-lang-1",
        )

        mock_provider.send_template_message.assert_called_once()
        kwargs = mock_provider.send_template_message.call_args.kwargs
        assert kwargs["language_code"] == "en"


# ==============================================================================
# TEST N: WHATSAPP_ACCESS_TOKEN takes precedence over legacy WHATSAPP_TOKEN
# ==============================================================================
def test_n_token_precedence_and_safe_warning(monkeypatch, caplog):
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "new-token-12345")
    monkeypatch.setattr(settings, "WHATSAPP_TOKEN", "old-token-67890")

    # Property access returns WHATSAPP_ACCESS_TOKEN or WHATSAPP_TOKEN without logging warning
    with caplog.at_level(logging.WARNING, logger="whatsapp"):
        token = settings.whatsapp_bearer_token
    assert token == "new-token-12345"
    assert len(caplog.records) == 0

    # Warning is emitted during application startup / config validation
    warnings = settings.validate_whatsapp_platform_config()
    assert any("Both WHATSAPP_ACCESS_TOKEN and legacy WHATSAPP_TOKEN are configured" in w for w in warnings)

    # Never log or expose token values
    for w in warnings:
        assert "new-token-12345" not in w
        assert "old-token-67890" not in w

    # Fallback to legacy if modern is empty
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "")
    monkeypatch.setattr(settings, "WHATSAPP_TOKEN", "old-token-67890")
    assert settings.whatsapp_bearer_token == "old-token-67890"


# ==============================================================================
# TEST O: Billing still succeeds when Meta fails
# ==============================================================================
@pytest.mark.asyncio
async def test_o_billing_still_succeeds_when_meta_fails(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    billing_service = BillingService()

    mock_existing_invoice = MagicMock(spec=Invoice)
    mock_existing_invoice.id = "inv-fail-safe-1"
    mock_existing_invoice.invoice_number = "INV-FS-001"
    mock_existing_invoice.customer_phone = "9876543210"
    mock_existing_invoice.total_amount = 800.0
    mock_existing_invoice.save = AsyncMock()

    with patch("app.services.billing.Invoice.find_one", AsyncMock(return_value=mock_existing_invoice)), \
         patch("app.services.whatsapp.whatsapp_service.send_template_message", AsyncMock(side_effect=Exception("Meta Cloud API 500 Internal Error"))):

        invoice = await billing_service.update_invoice_from_appointment(
            appointment_id="appt-fs-1",
            salon_id="salon-1",
            salon_name="Glam Salon",
            salon_phone="9876543210",
            salon_address="Main St",
            customer_id="cust-1",
            customer_name="Client Name",
            customer_phone="9876543210",
            services=[],
            products=[],
            payment_status="PAID",
            payment_method="CASH",
            total_amount=800.0,
            paid_amount=800.0,
            send_whatsapp=True,
            send_bill_pdf=False,
        )

        # Invoice still successfully returned
        assert invoice is not None
        assert invoice.id == "inv-fail-safe-1"


# ==============================================================================
# TEST P: Concurrency-safe stale SENDING recovery prevents duplicate sends
# ==============================================================================
@pytest.mark.asyncio
async def test_p_stale_sending_concurrency_safe_claim(monkeypatch):
    monkeypatch.setattr(settings, "WHATSAPP_SENDER_MODE", "platform")
    monkeypatch.setattr(settings, "WHATSAPP_PHONE_NUMBER_ID", "central-phone-id")
    monkeypatch.setattr(settings, "WHATSAPP_ACCESS_TOKEN", "central-token")
    monkeypatch.setattr(settings, "WHATSAPP_TEST_RECIPIENT_PHONE", "")

    import asyncio

    service = WhatsAppService()
    mock_provider = MagicMock()
    mock_provider.send_template_message = AsyncMock(return_value={
        "success": True,
        "wamid": "wamid.concurrent.success.456",
        "response_body": {},
    })
    service.provider = mock_provider

    def make_stale_log(*args, **kwargs):
        return make_mock_log(
            id="stale-concurrent-1",
            status="SENDING",
            delivery_status=None,
            wamid=None,
            meta_message_id=None,
            created_at=datetime.now(timezone.utc) - timedelta(minutes=25),
            deduplication_key="salon-1:BILL:inv-concurrent-1:BILL_RECEIPT",
        )

    new_log_instance = make_mock_log(
        status="SENDING",
        deduplication_key="salon-1:BILL:inv-concurrent-1:BILL_RECEIPT",
    )

    # Simulate MongoDB atomic conditional update: only 1 caller can claim the document
    claim_count = 0
    claim_lock = asyncio.Lock()

    async def mock_atomic_claim(update_doc):
        nonlocal claim_count
        async with claim_lock:
            if claim_count == 0:
                claim_count += 1
                return MagicMock(modified_count=1)
            return MagicMock(modified_count=0)

    with patch("app.services.whatsapp.service.WhatsAppMessageLog", return_value=new_log_instance) as mock_cls:
        mock_cls.find_one = AsyncMock(side_effect=make_stale_log)
        mock_cls.find.return_value.update = AsyncMock(side_effect=mock_atomic_claim)

        # Launch two concurrent requests attempting to recover the same stale record
        result1, result2 = await asyncio.gather(
            service.send_template_message(
                salon_id="salon-1",
                customer_id="cust-1",
                recipient_phone="9876543210",
                message_type="BILL_RECEIPT",
                template_name="service_completion_thank_you",
                reference_type="BILL",
                reference_id="inv-concurrent-1",
            ),
            service.send_template_message(
                salon_id="salon-1",
                customer_id="cust-1",
                recipient_phone="9876543210",
                message_type="BILL_RECEIPT",
                template_name="service_completion_thank_you",
                reference_type="BILL",
                reference_id="inv-concurrent-1",
            ),
        )

        # Exactly ONE request claims and sends; the other stops without sending
        assert mock_provider.send_template_message.call_count == 1

        # One result is the newly sent message, the other is the un-resent existing log
        statuses = [result1.status, result2.status]
        assert "SENT" in statuses
        assert statuses.count("SENT") == 1
