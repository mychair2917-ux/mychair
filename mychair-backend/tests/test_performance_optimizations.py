from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from beanie import PydanticObjectId

from app.api.v1.endpoints.appointments import (
    _batch_appointment_responses,
    _format_appointment_item,
)
from app.models.appointment import (
    Appointment,
    ProductSnapshot,
    ServiceSnapshot,
    StatusHistory,
)
from app.models.billing import Invoice, Payment
from app.models.customer import Customer
from app.models.user import User
from app.models.whatsapp_message import WhatsAppMessageLog
from app.services.appointment import AppointmentService
from app.services.dashboard_service import DashboardService
from app.services.whatsapp.service import WhatsAppService


@pytest.fixture
def mock_appointment():
    now = datetime(2026, 7, 26, 10, 0, 0, tzinfo=timezone.utc)
    appt = MagicMock(spec=Appointment)
    appt.id = PydanticObjectId("507f1f77bcf86cd799439011")
    appt.salon_id = "salon-1"
    appt.customer_id = "507f1f77bcf86cd799439012"
    appt.staff_id = "507f1f77bcf86cd799439013"
    appt.start_datetime = now
    appt.end_datetime = now + timedelta(hours=1)
    appt.total_price = 150.0
    appt.status = "BOOKED"
    appt.notes = "Special request"
    appt.booking_source = "ONLINE"
    appt.payment_type = "CARD"
    appt.payment_status = "PAID"
    appt.paid_amount = 150.0
    appt.services = [
        MagicMock(
            service_id="srv-1",
            name="Haircut",
            price=100.0,
            duration_minutes=30,
            tax_rate=18.0,
            pricing_type="NORMAL",
            staff_id="507f1f77bcf86cd799439013",
            staff_name="John Doe",
        )
    ]
    appt.products = [
        MagicMock(
            product_id="prd-1",
            salon_product_id="sp-1",
            brand_id="br-1",
            name="Serum",
            price=50.0,
            tax_rate=18.0,
            quantity=1,
            staff_id="507f1f77bcf86cd799439013",
            staff_name="John Doe",
        )
    ]
    appt.status_history = [
        MagicMock(
            status="BOOKED",
            changed_at=now,
            changed_by="staff",
            reason=None,
        )
    ]
    return appt


def test_format_appointment_item_with_full_data(mock_appointment):
    customer = MagicMock(spec=Customer)
    customer.full_name = "Jane Doe"
    customer.phone = "+919876543210"

    staff = MagicMock(spec=User)
    staff.first_name = "John"
    staff.last_name = "Doe"

    result = _format_appointment_item(
        mock_appointment,
        customer=customer,
        staff=staff,
        whatsapp_status="delivered",
    )

    assert result["id"] == "507f1f77bcf86cd799439011"
    assert result["customer_name"] == "Jane Doe"
    assert result["customer_phone"] == "+919876543210"
    assert result["staff_name"] == "John Doe"
    assert result["whatsapp_status"] == "delivered"
    assert result["total_price"] == 150.0
    assert len(result["services"]) == 1
    assert len(result["products"]) == 1


def test_format_appointment_item_with_missing_and_deleted_records(mock_appointment):
    result = _format_appointment_item(
        mock_appointment,
        customer=None,
        staff=None,
        whatsapp_status="pending",
    )

    assert result["customer_name"] == "Deleted Customer"
    assert result["customer_phone"] == ""
    assert result["staff_name"] is None
    assert result["whatsapp_status"] == "pending"


@pytest.mark.asyncio
async def test_batch_appointment_responses_preserves_order(mock_appointment):
    appt2 = MagicMock(spec=Appointment)
    appt2.id = PydanticObjectId("507f1f77bcf86cd799439021")
    appt2.salon_id = "salon-1"
    appt2.customer_id = None
    appt2.staff_id = None
    appt2.start_datetime = datetime(2026, 7, 26, 12, 0, 0, tzinfo=timezone.utc)
    appt2.end_datetime = datetime(2026, 7, 26, 13, 0, 0, tzinfo=timezone.utc)
    appt2.total_price = 50.0
    appt2.status = "COMPLETED"
    appt2.notes = None
    appt2.booking_source = "WALK_IN"
    appt2.payment_type = "CASH"
    appt2.payment_status = "PAID"
    appt2.paid_amount = 50.0
    appt2.services = []
    appt2.products = []

    with patch("app.api.v1.endpoints.appointments.Customer.find") as mock_cust_find, \
         patch("app.api.v1.endpoints.appointments.User.find") as mock_user_find, \
         patch("app.api.v1.endpoints.appointments.whatsapp_service.latest_statuses_for_appointments", new_callable=AsyncMock) as mock_wa:

        mock_cust_find.return_value.to_list = AsyncMock(return_value=[])
        mock_user_find.return_value.to_list = AsyncMock(return_value=[])
        mock_wa.return_value = {str(mock_appointment.id): "read"}

        results = await _batch_appointment_responses([mock_appointment, appt2])

        assert len(results) == 2
        assert results[0]["id"] == str(mock_appointment.id)
        assert results[0]["whatsapp_status"] == "read"
        assert results[1]["id"] == str(appt2.id)
        assert results[1]["whatsapp_status"] == "pending"
        assert results[1]["customer_name"] == "Deleted Customer"


@pytest.mark.asyncio
async def test_whatsapp_latest_statuses_for_invoices_and_appointments():
    wa_service = WhatsAppService()

    # Empty list should immediately return empty dict without DB queries
    assert await wa_service.latest_statuses_for_invoices([]) == {}
    assert await wa_service.latest_statuses_for_appointments([]) == {}

    # Mock DB response
    log1 = MagicMock(spec=WhatsAppMessageLog)
    log1.invoice_id = "inv-1"
    log1.delivery_status = "delivered"
    log1.status = "sent"

    log2 = MagicMock(spec=WhatsAppMessageLog)
    log2.invoice_id = "inv-1"  # older log for same invoice
    log2.delivery_status = "sent"
    log2.status = "sent"

    log3 = MagicMock(spec=WhatsAppMessageLog)
    log3.invoice_id = "inv-2"
    log3.delivery_status = None
    log3.status = "failed"

    with patch("app.services.whatsapp.service.WhatsAppMessageLog.find") as mock_find:
        mock_find.return_value.sort.return_value.to_list = AsyncMock(return_value=[log1, log2, log3])

        statuses = await wa_service.latest_statuses_for_invoices(["inv-1", "inv-2", "inv-3"])

        # inv-1 should pick latest (log1)
        assert statuses["inv-1"] == "delivered"
        # inv-2 should pick log3 fallback to status
        assert statuses["inv-2"] == "failed"
        # inv-3 was not returned in logs
        assert "inv-3" not in statuses


@pytest.mark.asyncio
async def test_build_history_responses_batch(mock_appointment):
    service = AppointmentService()

    # Empty list returns empty list
    assert await service.build_history_responses_batch([]) == []

    mock_invoice = MagicMock(spec=Invoice)
    mock_invoice.id = PydanticObjectId("507f1f77bcf86cd799439031")
    mock_invoice.appointment_id = str(mock_appointment.id)
    mock_invoice.invoice_number = "INV-001"
    mock_invoice.status = "FINALIZED"
    mock_invoice.subtotal = 150.0
    mock_invoice.tax_amount = 0.0
    mock_invoice.discount_amount = 0.0
    mock_invoice.total_amount = 150.0
    mock_invoice.paid_amount = 150.0

    mock_payment = MagicMock(spec=Payment)
    mock_payment.id = PydanticObjectId("507f1f77bcf86cd799439041")
    mock_payment.invoice_id = str(mock_invoice.id)
    mock_payment.amount = 150.0
    mock_payment.payment_method = "CARD"
    mock_payment.status = "SUCCESSFUL"
    mock_payment.transaction_reference = "TXN-123"
    mock_payment.refunded_amount = 0.0
    mock_payment.refund_reason = None
    mock_payment.payment_date = datetime(2026, 7, 26, 11, 0, 0, tzinfo=timezone.utc)

    customer = MagicMock(spec=Customer)
    customer.full_name = "Jane Doe"
    customer.phone = "+919876543210"

    with patch("app.services.appointment.User.find") as mock_user_find, \
         patch("app.services.appointment.Invoice.find") as mock_inv_find, \
         patch("app.services.appointment.Payment.find") as mock_pmt_find, \
         patch.object(service.whatsapp_service, "latest_statuses_for_appointments", new_callable=AsyncMock) as mock_wa:

        mock_user_find.return_value.to_list = AsyncMock(return_value=[])
        mock_inv_find.return_value.sort.return_value.to_list = AsyncMock(return_value=[mock_invoice])
        mock_pmt_find.return_value.sort.return_value.to_list = AsyncMock(return_value=[mock_payment])
        mock_wa.return_value = {str(mock_appointment.id): "read"}

        batch_results = await service.build_history_responses_batch([mock_appointment], customer=customer)

        assert len(batch_results) == 1
        item = batch_results[0]
        assert item["id"] == str(mock_appointment.id)
        assert item["customer_name"] == "Jane Doe"
        assert item["whatsapp_status"] == "read"
        assert item["billing_details"]["invoice_number"] == "INV-001"
        assert len(item["billing_details"]["payments"]) == 1
        assert item["billing_details"]["payments"][0]["transaction_reference"] == "TXN-123"


@pytest.mark.asyncio
async def test_dashboard_appointment_trend_consolidation():
    service = DashboardService()
    today = datetime(2026, 7, 26, 12, 0, 0, tzinfo=timezone.utc)

    appt1 = MagicMock(spec=Appointment)
    appt1.start_datetime = datetime(2026, 7, 26, 10, 0, 0, tzinfo=timezone.utc)

    appt2 = MagicMock(spec=Appointment)
    appt2.start_datetime = datetime(2026, 7, 25, 14, 0, 0, tzinfo=timezone.utc)

    with patch("app.services.dashboard_service.Appointment.find") as mock_find:
        mock_find.return_value.to_list = AsyncMock(return_value=[appt1, appt2])

        trend = await service._appointment_trend_tenant("tenant-1", today, days=7)

        assert len(trend) == 7
        # Trend is chronological: offset 6 down to 0
        # Today is last element
        assert trend[-1].value == 1.0  # appt1
        assert trend[-2].value == 1.0  # appt2
        assert trend[0].value == 0.0   # zero days preserved as 0.0
        # Verify single query was made instead of 7
        assert mock_find.call_count == 1


@pytest.mark.asyncio
async def test_dashboard_inventory_overview_reuse():
    service = DashboardService()

    mock_overview = MagicMock()
    mock_overview.warnings = [
        {"product_name": "Shampoo A"},
        {"product_name": "Shampoo B"},
    ]

    # Calling _inventory_alerts_for_tenant with overview should NOT call overview again
    with patch.object(service._inventory_service, "overview", new_callable=AsyncMock) as mock_service_overview:
        alerts = await service._inventory_alerts_for_tenant(
            "tenant-1",
            low_stock=2,
            overview=mock_overview,
        )
        assert len(alerts) == 1
        assert "Shampoo A" in alerts[0].message
        mock_service_overview.assert_not_called()
