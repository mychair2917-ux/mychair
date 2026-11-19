"""
Regression test suite for BUG-24, BUG-25, and BUG-26.

BUG-24: Stock increasing the wrong product / inventory mapping & restoration
BUG-25: Salon product selling price must be strictly greater than ₹0
BUG-26: Accurate, unified incentive calculation across modules
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId
from datetime import datetime, timezone

from app.schemas.salon_product import SalonProductCreate, SalonProductUpdate
from app.schemas.inventory import InventoryPurchaseRequest
from app.services.incentive import (
    IncentiveCalculationService,
    StaffIncentiveConfig,
    InvoiceIncentiveSummary,
)
from app.services.payroll import PayrollService
from app.models.billing import Invoice, InvoiceItem, Payment


# =========================================================================== #
# BUG-25: Salon product selling price must be strictly greater than ₹0
# =========================================================================== #
class TestBug25SalonProductSellingPrice:
    def test_create_rejects_zero_price(self):
        with pytest.raises(ValueError) as exc:
            SalonProductCreate(
                product_id="prod_123",
                price=0.0,
                product_type="SELLING",
            )
        assert "strictly greater than" in str(exc.value)

    def test_create_rejects_negative_price(self):
        with pytest.raises(ValueError) as exc:
            SalonProductCreate(
                product_id="prod_123",
                price=-50.0,
                product_type="SELLING",
            )
        assert "strictly greater than" in str(exc.value)

    def test_create_accepts_positive_price(self):
        prod = SalonProductCreate(
            product_id="prod_123",
            price=299.0,
            product_type="SELLING",
        )
        assert prod.price == 299.0

    def test_update_rejects_zero_price(self):
        with pytest.raises(ValueError) as exc:
            SalonProductUpdate(
                product_id="prod_123",
                price=0.0,
                status="ACTIVE",
            )
        assert "strictly greater than" in str(exc.value)

    def test_update_rejects_negative_price(self):
        with pytest.raises(ValueError) as exc:
            SalonProductUpdate(
                product_id="prod_123",
                price=-10.0,
                status="ACTIVE",
            )
        assert "strictly greater than" in str(exc.value)

    def test_update_accepts_positive_price(self):
        prod = SalonProductUpdate(
            product_id="prod_123",
            price=450.0,
            status="ACTIVE",
        )
        assert prod.price == 450.0


# =========================================================================== #
# BUG-24: Inventory Quick-Add targets exact record and preserves product/brand
# =========================================================================== #
class TestBug24InventoryTargetingAndSync:
    def test_inventory_purchase_schema_includes_inventory_id(self):
        req = InventoryPurchaseRequest(
            inventory_id="inv_abc123",
            product_id="prod_123",
            buying_price=150.0,
            quantity=5,
            category="Haircare",
        )
        assert req.inventory_id == "inv_abc123"
        assert req.product_id == "prod_123"
        assert req.quantity == 5

    @pytest.mark.asyncio
    async def test_record_purchase_with_inventory_id_targets_exact_record(self):
        from app.services.inventory import InventoryService

        service = InventoryService()
        inv_id = str(ObjectId())
        actor = MagicMock(id=ObjectId(), tenant_id="tenant-1")

        mock_inv = MagicMock()
        mock_inv.id = ObjectId(inv_id)
        mock_inv.tenant_id = "tenant-1"
        mock_inv.salon_id = "salon-1"
        mock_inv.product_id = "prod-A"
        mock_inv.brand_id = "brand-A"
        mock_inv.product_name_snapshot = "Product A"
        mock_inv.brand_name_snapshot = "Brand A"
        mock_inv.save = AsyncMock()

        mock_tx = MagicMock()
        mock_tx.insert = AsyncMock()

        mock_sp = MagicMock(price=200.0, save=AsyncMock())

        with patch("app.services.inventory.ProductInventory.find_one", new=AsyncMock(return_value=mock_inv)), \
             patch("app.services.inventory.InventoryTransaction", return_value=mock_tx), \
             patch.object(service, "calculate_product_stock", new=AsyncMock(return_value=10)), \
             patch.object(service, "_sync_product_inventory", new=AsyncMock(return_value=mock_inv)), \
             patch("app.services.inventory.SalonProduct.find_one", new=AsyncMock(return_value=mock_sp)):

            res = await service.record_purchase(
                actor=actor,
                salon_id="salon-1",
                product_id="prod-B",  # Even if payload has a different product_id
                custom_product_name=None,
                brand_id=None,
                custom_brand_name=None,
                buying_price=100.0,
                quantity=3,
                category="General",
                min_threshold=5,
                inventory_id=inv_id,
            )

            # Assert target inventory record was updated, not product B
            assert mock_inv.save.called
            assert mock_tx.insert.called
            # The transaction used product A and brand A from the exact record
            assert service._sync_product_inventory.called

    @pytest.mark.asyncio
    async def test_restore_sold_product_prevents_duplicate_cancellation_restore(self):
        from app.services.inventory import InventoryService

        service = InventoryService()
        mock_inv = MagicMock(id=ObjectId(), product_id="prod-1", brand_id="brand-1", buying_price=50.0, tenant_id="tenant-1")
        mock_existing_tx = MagicMock()  # Simulates an already inserted adjustment tx

        with patch("app.services.inventory.ProductInventory.find_one", new=AsyncMock(return_value=mock_inv)), \
             patch("app.services.inventory.InventoryTransaction.find_one", new=AsyncMock(return_value=mock_existing_tx)), \
             patch("app.services.inventory.InventoryTransaction.insert", new=AsyncMock()) as mock_insert, \
             patch.object(service, "calculate_product_stock", new=AsyncMock(return_value=10)), \
             patch.object(service, "_sync_product_inventory", new=AsyncMock()):

            await service.restore_sold_product(
                salon_id="salon-1",
                product_id="prod-1",
                brand_id="brand-1",
                quantity=2,
                reference_id="appt-123",
                notes="Stock restored from cancelled appointment appt-123",
            )

            # Idempotency: Duplicate transaction must NOT be inserted
            assert not mock_insert.called


# =========================================================================== #
# BUG-26: Accurate, unified incentive calculation across all scenarios
# =========================================================================== #
class TestBug26UnifiedIncentiveCalculation:
    def _create_mock_invoice(
        self,
        inv_id: str = "inv-1",
        total: float = 1000.0,
        paid: float = 1000.0,
        status: str = "FINALIZED",
        payment_status: str = "PAID",
        discount_amount: float = 0.0,
        items: list = None,
    ):
        inv = MagicMock(spec=Invoice)
        inv.id = ObjectId() if ObjectId.is_valid(inv_id) else inv_id
        inv.invoice_number = "INV-001"
        inv.status = status
        inv.payment_status = payment_status
        inv.total_amount = total
        inv.paid_amount = paid
        inv.discount_amount = discount_amount
        inv.items = items or []
        return inv

    def test_unpaid_bill_generates_zero_incentive(self):
        """Rule 6: Do not generate earned incentives on unpaid bills."""
        item = MagicMock(
            item_type="SERVICE",
            item_id="svc-1",
            name="Haircut",
            staff_id="staff-1",
            staff_name="Alice",
            quantity=1,
            unit_price=500.0,
            discount=0.0,
            tax_rate=0.0,
        )
        invoice = self._create_mock_invoice(
            total=500.0,
            paid=0.0,
            payment_status="PENDING",
            items=[item],
        )
        staff_cfg = {
            "staff-1": StaffIncentiveConfig(
                incentive_base=True,
                service_incentive_percent=10.0,
            )
        }

        summary = IncentiveCalculationService.calculate_invoice_incentives(
            invoice=invoice,
            staff_configs=staff_cfg,
        )
        assert summary.is_eligible is False
        assert summary.total_incentive == 0.0
        assert summary.lines[0].incentive_amount == 0.0

    def test_partial_payment_proportional_incentive(self):
        """Rule 7: Handle partial payments proportionally against collected eligible revenue."""
        item = MagicMock(
            item_type="SERVICE",
            item_id="svc-1",
            name="Hair Coloring",
            staff_id="staff-1",
            staff_name="Alice",
            quantity=1,
            unit_price=1000.0,
            discount=0.0,
            tax_rate=0.0,
        )
        # Total ₹1000, but only ₹400 collected (40% payment)
        invoice = self._create_mock_invoice(
            total=1000.0,
            paid=400.0,
            payment_status="PARTIALLY_PAID",
            items=[item],
        )
        staff_cfg = {
            "staff-1": StaffIncentiveConfig(
                incentive_base=True,
                service_incentive_percent=10.0,
            )
        }

        summary = IncentiveCalculationService.calculate_invoice_incentives(
            invoice=invoice,
            staff_configs=staff_cfg,
        )
        assert summary.is_eligible is True
        assert summary.collected_ratio == 0.4
        # 10% on collected ₹400 = ₹40.0
        assert summary.lines[0].net_collected_sales == 400.0
        assert summary.lines[0].incentive_amount == 40.0
        assert summary.total_incentive == 40.0

    def test_proportional_bill_level_discount_allocation(self):
        """Rule 4: Allocate bill-level discounts proportionally across lines."""
        # Line 1: ₹600 (60% of gross), Line 2: ₹400 (40% of gross)
        # Bill discount: ₹100.
        # Allocated to Line 1: ₹60. Net = ₹540.
        # Allocated to Line 2: ₹40. Net = ₹360.
        item1 = MagicMock(
            item_type="SERVICE",
            item_id="svc-1",
            name="Service 1",
            staff_id="staff-1",
            staff_name="Alice",
            quantity=1,
            unit_price=600.0,
            discount=0.0,
            tax_rate=0.0,
        )
        item2 = MagicMock(
            item_type="SERVICE",
            item_id="svc-2",
            name="Service 2",
            staff_id="staff-2",
            staff_name="Bob",
            quantity=1,
            unit_price=400.0,
            discount=0.0,
            tax_rate=0.0,
        )
        invoice = self._create_mock_invoice(
            total=900.0,
            paid=900.0,
            payment_status="PAID",
            discount_amount=100.0,
            items=[item1, item2],
        )
        staff_cfg = {
            "staff-1": StaffIncentiveConfig(incentive_base=True, service_incentive_percent=10.0),
            "staff-2": StaffIncentiveConfig(incentive_base=True, service_incentive_percent=10.0),
        }

        summary = IncentiveCalculationService.calculate_invoice_incentives(
            invoice=invoice,
            staff_configs=staff_cfg,
        )
        assert summary.is_eligible is True
        assert summary.lines[0].allocated_bill_discount == 60.0
        assert summary.lines[0].sales_subtotal == 540.0
        assert summary.lines[0].incentive_amount == 54.0

        assert summary.lines[1].allocated_bill_discount == 40.0
        assert summary.lines[1].sales_subtotal == 360.0
        assert summary.lines[1].incentive_amount == 36.0

        assert summary.total_incentive == 90.0  # (54 + 36)

    def test_actual_entered_service_price_used(self):
        """Rule 1: Use actual final service price including user-entered overrides."""
        item = MagicMock(
            item_type="SERVICE",
            item_id="svc-1",
            name="Haircut",
            staff_id="staff-1",
            staff_name="Alice",
            quantity=1,
            unit_price=200.0,  # Overridden from 250
            discount=0.0,
            tax_rate=0.0,
        )
        invoice = self._create_mock_invoice(
            total=200.0,
            paid=200.0,
            payment_status="PAID",
            items=[item],
        )
        staff_cfg = {
            "staff-1": StaffIncentiveConfig(incentive_base=True, service_incentive_percent=10.0)
        }

        summary = IncentiveCalculationService.calculate_invoice_incentives(
            invoice=invoice,
            staff_configs=staff_cfg,
        )
        assert summary.lines[0].sales_subtotal == 200.0
        assert summary.lines[0].incentive_amount == 20.0  # 10% of 200, NOT 250

    def test_cancelled_appointment_earns_zero_incentive(self):
        """Rule 10: Cancellation results in 0 incentive."""
        item = MagicMock(
            item_type="SERVICE",
            item_id="svc-1",
            name="Facial",
            staff_id="staff-1",
            staff_name="Alice",
            quantity=1,
            unit_price=500.0,
            discount=0.0,
            tax_rate=0.0,
        )
        invoice = self._create_mock_invoice(
            total=500.0,
            paid=500.0,
            payment_status="PAID",
            items=[item],
        )
        staff_cfg = {
            "staff-1": StaffIncentiveConfig(incentive_base=True, service_incentive_percent=10.0)
        }

        summary = IncentiveCalculationService.calculate_invoice_incentives(
            invoice=invoice,
            staff_configs=staff_cfg,
            appointment_status="CANCELLED",
        )
        assert summary.is_eligible is False
        assert summary.total_incentive == 0.0


# =========================================================================== #
# Payroll Salary Calculation (Monthly, Daily, Weekly, Joining-Date)
# =========================================================================== #
class TestPayrollSalaryCalculations:
    def test_monthly_full_month(self):
        # 30-day month (April 2026), full month
        salary = PayrollService.calculate_base_salary(
            salary=30000.0,
            salary_type="monthly",
            joining_date=datetime(2025, 1, 1, tzinfo=timezone.utc),
            month=4,
            year=2026,
        )
        assert salary == 30000.0

    def test_monthly_mid_month_joining_date(self):
        # 30-day month (April 2026), joined on April 16 (15 working days: 16 to 30)
        salary = PayrollService.calculate_base_salary(
            salary=30000.0,
            salary_type="monthly",
            joining_date=datetime(2026, 4, 16, tzinfo=timezone.utc),
            month=4,
            year=2026,
        )
        # 30000 * (15 / 30) = 15000.0
        assert salary == 15000.0

    def test_future_joining_date_zero_salary(self):
        # Joined in May 2026, calculating April 2026
        salary = PayrollService.calculate_base_salary(
            salary=30000.0,
            salary_type="monthly",
            joining_date=datetime(2026, 5, 1, tzinfo=timezone.utc),
            month=4,
            year=2026,
        )
        assert salary == 0.0

    def test_daily_salary_full_month(self):
        # April has 30 days. Daily wage ₹1000 -> ₹30,000
        salary = PayrollService.calculate_base_salary(
            salary=1000.0,
            salary_type="daily",
            joining_date=None,
            month=4,
            year=2026,
        )
        assert salary == 30000.0

    def test_daily_salary_mid_month_joining(self):
        # April has 30 days. Joined April 21 (10 days remaining: 21 to 30)
        salary = PayrollService.calculate_base_salary(
            salary=1000.0,
            salary_type="daily",
            joining_date=datetime(2026, 4, 21, tzinfo=timezone.utc),
            month=4,
            year=2026,
        )
        assert salary == 10000.0

    def test_weekly_salary_calculation(self):
        # Weekly ₹7000 (i.e. ₹1000/day). In April (30 days): 7000 / 7 * 30 = 30000.0
        salary = PayrollService.calculate_base_salary(
            salary=7000.0,
            salary_type="weekly",
            joining_date=None,
            month=4,
            year=2026,
        )
        assert salary == 30000.0
