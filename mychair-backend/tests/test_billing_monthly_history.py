"""
Unit tests for Billing Monthly Data Filtering, Latest-First Ordering, and Aggregates.
"""

import pytest
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock, patch
from fastapi import HTTPException
from app.api.v1.endpoints.billing import list_bills, router as billing_router
from app.utils.timezone import KOLKATA_TZ


def _mock_invoice(inv_id: str, inv_number: str, created_at: datetime, total: float = 1000.0, paid: float = 1000.0):
    inv = MagicMock()
    inv.id = inv_id
    inv.invoice_number = inv_number
    inv.appointment_id = None
    inv.salon_id = "salon-1"
    inv.salon_name = "Luxury Salon"
    inv.salon_phone = "9999999999"
    inv.salon_address = "MG Road"
    inv.customer_id = "cust-1"
    inv.customer_name = "John Doe"
    inv.customer_phone = "8888888888"
    inv.payment_method = "UPI"
    inv.payment_status = "PAID"
    inv.notes = None
    inv.status = "FINALIZED"
    inv.subtotal = total
    inv.tax_amount = 0.0
    inv.discount_amount = 0.0
    inv.total_amount = total
    inv.paid_amount = paid
    inv.remaining_amount = total - paid
    inv.items = []
    inv.created_at = created_at
    inv.finalized_at = created_at
    return inv


@pytest.mark.asyncio
async def test_list_bills_month_year_filter():
    """Verify month & year calculate correct 00:00:00 to next month 00:00:00 boundaries in local timezone."""
    mock_user = MagicMock()

    with patch("app.api.v1.endpoints.billing.Invoice") as MockInvoice, \
         patch("app.api.v1.endpoints.billing.whatsapp_service") as MockWA:
        
        mock_find_query = MagicMock()
        mock_find_query.sort.return_value = mock_find_query
        mock_find_query.skip.return_value = mock_find_query
        mock_find_query.limit.return_value = mock_find_query
        mock_find_query.to_list = AsyncMock(return_value=[])

        MockInvoice.find.return_value = mock_find_query
        mock_find_query.count = AsyncMock(return_value=0)
        MockWA.latest_statuses_for_invoices = AsyncMock(return_value={})

        await list_bills(
            salon_id="salon-1",
            month=10,
            year=2026,
            current_user=mock_user,
        )

        MockInvoice.find.assert_called()
        call_query = MockInvoice.find.call_args[0][0]
        assert "created_at" in call_query
        assert call_query["created_at"]["$gte"] == datetime(2026, 10, 1, 0, 0, 0, tzinfo=KOLKATA_TZ)
        assert call_query["created_at"]["$lt"] == datetime(2026, 11, 1, 0, 0, 0, tzinfo=KOLKATA_TZ)


@pytest.mark.asyncio
async def test_list_bills_december_boundary_wraps_year():
    """Verify month 12 wraps to next year month 1."""
    mock_user = MagicMock()

    with patch("app.api.v1.endpoints.billing.Invoice") as MockInvoice, \
         patch("app.api.v1.endpoints.billing.whatsapp_service") as MockWA:
        
        mock_find_query = MagicMock()
        mock_find_query.sort.return_value = mock_find_query
        mock_find_query.skip.return_value = mock_find_query
        mock_find_query.limit.return_value = mock_find_query
        mock_find_query.to_list = AsyncMock(return_value=[])

        MockInvoice.find.return_value = mock_find_query
        mock_find_query.count = AsyncMock(return_value=0)
        MockWA.latest_statuses_for_invoices = AsyncMock(return_value={})

        await list_bills(
            salon_id="salon-1",
            month=12,
            year=2026,
            current_user=mock_user,
        )

        call_query = MockInvoice.find.call_args[0][0]
        assert call_query["created_at"]["$gte"] == datetime(2026, 12, 1, 0, 0, 0, tzinfo=KOLKATA_TZ)
        assert call_query["created_at"]["$lt"] == datetime(2027, 1, 1, 0, 0, 0, tzinfo=KOLKATA_TZ)


@pytest.mark.asyncio
async def test_list_bills_deterministic_latest_first_sort():
    """Verify sorting uses created_at DESC and id DESC tie-breaker."""
    mock_user = MagicMock()

    with patch("app.api.v1.endpoints.billing.Invoice") as MockInvoice, \
         patch("app.api.v1.endpoints.billing.whatsapp_service") as MockWA:
        
        mock_find_query = MagicMock()
        mock_find_query.sort.return_value = mock_find_query
        mock_find_query.skip.return_value = mock_find_query
        mock_find_query.limit.return_value = mock_find_query
        mock_find_query.to_list = AsyncMock(return_value=[])

        MockInvoice.find.return_value = mock_find_query
        mock_find_query.count = AsyncMock(return_value=0)
        MockWA.latest_statuses_for_invoices = AsyncMock(return_value={})

        await list_bills(
            salon_id="salon-1",
            month=9,
            year=2026,
            current_user=mock_user,
        )

        # Must be called with ("-created_at", "-_id")
        mock_find_query.sort.assert_called_with("-created_at", "-_id")


@pytest.mark.asyncio
async def test_list_bills_invalid_month_validation():
    """Verify 422 is raised for invalid month values."""
    mock_user = MagicMock()
    with pytest.raises(HTTPException) as exc_info:
        await list_bills(salon_id="salon-1", month=13, year=2026, current_user=mock_user)
    assert exc_info.value.status_code == 422
    assert "Invalid month" in exc_info.value.detail


@pytest.mark.asyncio
async def test_list_bills_empty_month_returns_empty_state_and_zero_totals():
    """Verify empty month returns empty items, total=0, and zero totals."""
    mock_user = MagicMock()

    with patch("app.api.v1.endpoints.billing.Invoice") as MockInvoice, \
         patch("app.api.v1.endpoints.billing.whatsapp_service") as MockWA:
        
        mock_find_query = MagicMock()
        mock_find_query.sort.return_value = mock_find_query
        mock_find_query.skip.return_value = mock_find_query
        mock_find_query.limit.return_value = mock_find_query
        mock_find_query.to_list = AsyncMock(return_value=[])

        MockInvoice.find.return_value = mock_find_query
        mock_find_query.count = AsyncMock(return_value=0)
        MockWA.latest_statuses_for_invoices = AsyncMock(return_value={})

        res = await list_bills(
            salon_id="salon-1",
            month=11,
            year=2026,
            current_user=mock_user,
        )

        import json
        payload = json.loads(res.body.decode())
        assert payload["success"] is True
        data = payload["data"]
        assert data["items"] == []
        assert data["total"] == 0
        assert data["month"] == 11
        assert data["year"] == 2026
        assert data["totals"]["total_bills"] == 0
        assert data["totals"]["total_amount"] == 0.0
        assert data["totals"]["total_paid"] == 0.0
        assert data["totals"]["total_pending"] == 0.0


@pytest.mark.asyncio
async def test_list_bills_totals_aggregated_from_month():
    """Verify monthly aggregate totals are computed for all matching bills."""
    mock_user = MagicMock()
    dt = datetime(2026, 10, 15, 12, 0, tzinfo=KOLKATA_TZ)
    inv1 = _mock_invoice("1", "INV-001", dt, total=2500.0, paid=2000.0)
    inv2 = _mock_invoice("2", "INV-002", dt, total=1500.0, paid=1500.0)

    with patch("app.api.v1.endpoints.billing.Invoice") as MockInvoice, \
         patch("app.api.v1.endpoints.billing.whatsapp_service") as MockWA:
        
        mock_find_query = MagicMock()
        mock_find_query.sort.return_value = mock_find_query
        mock_find_query.skip.return_value = mock_find_query
        mock_find_query.limit.return_value = mock_find_query
        mock_find_query.to_list = AsyncMock(return_value=[inv2, inv1])

        MockInvoice.find.return_value = mock_find_query
        mock_find_query.count = AsyncMock(return_value=2)

        # Mock aggregation pipeline result
        mock_agg = MagicMock()
        mock_agg.to_list = AsyncMock(return_value=[{
            "total_amount": 4000.0,
            "total_paid": 3500.0,
            "total_pending": 500.0,
            "total_tax": 200.0,
            "total_discount": 100.0,
        }])
        MockInvoice.aggregate.return_value = mock_agg
        MockWA.latest_statuses_for_invoices = AsyncMock(return_value={})

        res = await list_bills(
            salon_id="salon-1",
            month=10,
            year=2026,
            current_user=mock_user,
        )

        import json
        data = json.loads(res.body.decode())["data"]
        assert data["total"] == 2
        assert len(data["items"]) == 2
        assert data["totals"]["total_bills"] == 2
        assert data["totals"]["total_amount"] == 4000.0
        assert data["totals"]["total_paid"] == 3500.0
        assert data["totals"]["total_pending"] == 500.0


@pytest.mark.asyncio
async def test_list_bills_search_combined_with_month():
    """Verify search filter and month boundaries are combined in the query."""
    mock_user = MagicMock()

    with patch("app.api.v1.endpoints.billing.Invoice") as MockInvoice, \
         patch("app.api.v1.endpoints.billing.whatsapp_service") as MockWA:
        
        mock_find_query = MagicMock()
        mock_find_query.sort.return_value = mock_find_query
        mock_find_query.skip.return_value = mock_find_query
        mock_find_query.limit.return_value = mock_find_query
        mock_find_query.to_list = AsyncMock(return_value=[])

        MockInvoice.find.return_value = mock_find_query
        mock_find_query.count = AsyncMock(return_value=0)
        MockWA.latest_statuses_for_invoices = AsyncMock(return_value={})

        await list_bills(
            salon_id="salon-1",
            month=10,
            year=2026,
            search="Rahul",
            current_user=mock_user,
        )

        call_query = MockInvoice.find.call_args[0][0]
        assert "created_at" in call_query
        assert "$or" in call_query
        assert call_query["salon_id"] == "salon-1"


def test_history_route_registered():
    """Verify /history route is registered on billing router alongside /bills."""
    paths = [route.path for route in billing_router.routes]
    assert "/bills" in paths
    assert "/history" in paths


@pytest.mark.asyncio
async def test_list_bills_pagination_with_month():
    """Verify skip and limit are applied properly for monthly pagination."""
    mock_user = MagicMock()

    with patch("app.api.v1.endpoints.billing.Invoice") as MockInvoice, \
         patch("app.api.v1.endpoints.billing.whatsapp_service") as MockWA:
        
        mock_find_query = MagicMock()
        mock_find_query.sort.return_value = mock_find_query
        mock_find_query.skip.return_value = mock_find_query
        mock_find_query.limit.return_value = mock_find_query
        mock_find_query.to_list = AsyncMock(return_value=[])

        MockInvoice.find.return_value = mock_find_query
        mock_find_query.count = AsyncMock(return_value=42)
        MockWA.latest_statuses_for_invoices = AsyncMock(return_value={})

        import json
        res = await list_bills(
            salon_id="salon-1",
            month=10,
            year=2026,
            page=3,
            limit=10,
            current_user=mock_user,
        )

        # skip = (3 - 1) * 10 = 20
        mock_find_query.skip.assert_called_with(20)
        mock_find_query.limit.assert_called_with(10)

        payload = json.loads(res.body.decode())
        assert payload["data"]["page"] == 3
        assert payload["data"]["limit"] == 10
        assert payload["data"]["total"] == 42
        assert payload["data"]["pages"] == 5


@pytest.mark.asyncio
async def test_list_bills_preserves_tenant_and_salon_scope():
    """Verify salon scoping and active tenant context are maintained with month filter."""
    mock_user = MagicMock()

    with patch("app.api.v1.endpoints.billing.Invoice") as MockInvoice, \
         patch("app.api.v1.endpoints.billing.whatsapp_service") as MockWA, \
         patch("app.core.tenant_context.get_tenant_id", return_value="tenant-999"):
        
        mock_find_query = MagicMock()
        mock_find_query.sort.return_value = mock_find_query
        mock_find_query.skip.return_value = mock_find_query
        mock_find_query.limit.return_value = mock_find_query
        mock_find_query.to_list = AsyncMock(return_value=[])

        MockInvoice.find.return_value = mock_find_query
        mock_find_query.count = AsyncMock(return_value=0)
        MockWA.latest_statuses_for_invoices = AsyncMock(return_value={})

        await list_bills(
            salon_id="branch-123",
            month=10,
            year=2026,
            current_user=mock_user,
        )

        call_query = MockInvoice.find.call_args[0][0]
        assert call_query["salon_id"] == "branch-123"
        assert call_query["tenant_id"] == "tenant-999"
        assert call_query["is_deleted"] is False
        assert "created_at" in call_query

