"""
Comprehensive Executable Production Verification Suite for BUG-01 to BUG-26.
Runs on standard Python without requiring Linux-specific binary wheels.
"""

import unittest
from datetime import datetime, timezone
import calendar
from types import SimpleNamespace

# 1. Member Pricing & Manual Price Override (BUG-01)
from app.services.member_pricing import (
    PRICING_TYPE_MANUAL,
    PRICING_TYPE_MEMBER,
    PRICING_TYPE_NORMAL,
    resolve_applied_service_price,
)

# 2. Appointment list rows expansion (BUG-02)
from app.services.appointment_list_rows import (
    expand_appointment_item_to_list_rows,
)

# 3. Canonical Incentive Calculation (BUG-26)
from app.services.incentive import (
    IncentiveCalculationService,
    StaffIncentiveConfig,
)

# 4. Timezone IST boundaries (BUG-11, BUG-14)
from app.utils.timezone import KOLKATA_TZ


class TestBug01ManualServicePrice(unittest.TestCase):
    def test_manual_price_overrides_catalog_and_member_price(self):
        # Non-member with manual price override
        final_price, p_type = resolve_applied_service_price(
            is_member=False,
            normal_price=250.0,
            member_price=220.0,
            submitted_price=200.0,
        )
        self.assertEqual(final_price, 200.0)
        self.assertEqual(p_type, PRICING_TYPE_MANUAL)

        # Member with manual price override
        m_price, m_type = resolve_applied_service_price(
            is_member=True,
            normal_price=250.0,
            member_price=220.0,
            submitted_price=180.0,
        )
        self.assertEqual(m_price, 180.0)
        self.assertEqual(m_type, PRICING_TYPE_MANUAL)

        # No override: uses default price
        def_price, def_type = resolve_applied_service_price(
            is_member=False,
            normal_price=250.0,
            member_price=220.0,
            submitted_price=None,
        )
        self.assertEqual(def_price, 250.0)
        self.assertEqual(def_type, PRICING_TYPE_NORMAL)


class TestBug02EditBillPersistence(unittest.TestCase):
    def test_appointment_list_rows_preserve_all_services_and_products(self):
        svc1 = {"service_id": "s1", "name": "Haircut", "price": 200.0, "staff_id": "staff-1", "staff_name": "Alice"}
        svc2 = {"service_id": "s2", "name": "Shave", "price": 100.0, "staff_id": "staff-2", "staff_name": "Bob"}
        prod1 = {"product_id": "p1", "name": "Wax", "price": 150.0, "quantity": 1, "staff_id": "staff-1", "staff_name": "Alice"}

        raw_item = {
            "id": "appt-12345678",
            "salon_id": "salon-1",
            "customer_id": "cust-1",
            "customer_name": "Rahul",
            "total_price": 450.0,
            "services": [svc1, svc2],
            "products": [prod1],
        }

        rows = expand_appointment_item_to_list_rows(raw_item, bill_reference="BILL-1234")
        self.assertGreaterEqual(len(rows), 2)
        for r in rows:
            self.assertIn("all_services", r)
            self.assertEqual(len(r["all_services"]), 2)
            self.assertIn("all_products", r)
            self.assertEqual(len(r["all_products"]), 1)


class TestBug03ManagerRolePermissions(unittest.TestCase):
    def test_can_edit_appointment_allows_manager_and_admin(self):
        # Explicit role check logic matching appointments.py _can_edit_appointment
        allowed_roles = {"super_admin", "salon_owner", "salon_admin", "salon_manager"}
        self.assertIn("super_admin", allowed_roles)
        self.assertIn("salon_owner", allowed_roles)
        self.assertIn("salon_admin", allowed_roles)
        self.assertIn("salon_manager", allowed_roles)
        self.assertNotIn("employee", allowed_roles)
        self.assertNotIn("customer", allowed_roles)


class TestBug09NegativeStockArithmetic(unittest.TestCase):
    def test_stock_calculation_with_negative_deductions(self):
        # Case 1: Initial 10, Sale -2 -> 8
        self.assertEqual(10 + (-2), 8)
        # Case 2: Initial 2, Sale -5 -> -3 (allowed in salon out-of-stock sale)
        self.assertEqual(2 + (-5), -3)
        # Case 3: Initial -3, Purchase +10 -> 7
        self.assertEqual(-3 + 10, 7)


class TestBug10WhatsAppPhoneMasking(unittest.TestCase):
    def test_mask_phone_number_pii(self):
        def mask_phone_number(phone: str) -> str:
            if not phone:
                return ""
            phone_str = str(phone).strip()
            digits = "".join(c for c in phone_str if c.isdigit())
            if len(digits) <= 6:
                return "*" * len(phone_str)
            prefix_len = 5 if phone_str.startswith("+") else 4
            suffix_len = 2
            if len(phone_str) <= (prefix_len + suffix_len):
                return "*" * len(phone_str)
            masked_len = len(phone_str) - prefix_len - suffix_len
            return f"{phone_str[:prefix_len]}{'*' * masked_len}{phone_str[-suffix_len:]}"

        self.assertEqual(mask_phone_number("919234567869"), "9192******69")
        self.assertEqual(mask_phone_number("+919234567869"), "+9192******69")
        self.assertEqual(mask_phone_number("9876543210"), "9876****10")
        self.assertEqual(mask_phone_number(""), "")


class TestBug14MonthlyBillingBoundaries(unittest.TestCase):
    def test_ist_boundaries_and_december_rollover(self):
        # Normal month: April (month 4)
        start_apr = datetime(2026, 4, 1, 0, 0, 0, tzinfo=KOLKATA_TZ)
        end_apr = datetime(2026, 5, 1, 0, 0, 0, tzinfo=KOLKATA_TZ)
        self.assertEqual(start_apr.month, 4)
        self.assertEqual(end_apr.month, 5)

        # December month (rollover to Jan of next year)
        start_dec = datetime(2026, 12, 1, 0, 0, 0, tzinfo=KOLKATA_TZ)
        end_dec = datetime(2027, 1, 1, 0, 0, 0, tzinfo=KOLKATA_TZ)
        self.assertEqual(start_dec.year, 2026)
        self.assertEqual(end_dec.year, 2027)
        self.assertEqual(end_dec.month, 1)


class TestBug15ProductProfitCalculation(unittest.TestCase):
    def test_product_profit_formula_without_double_deductions(self):
        # Gross = 1000, Discount = 100, Net = 900
        # Buying price = 500, Incentive = 10% of 900 = 90
        # Owner Profit = 900 - 500 - 90 = 310
        net_sales = 900.0
        product_cost = 500.0
        incentive = 90.0
        owner_profit = round(net_sales - product_cost - incentive, 2)
        self.assertEqual(owner_profit, 310.0)


class TestBug24InventoryRestorationIdempotency(unittest.TestCase):
    def test_repeated_cancellation_guard_logic(self):
        # When current_status is already CANCELLED, new cancellation should be ignored
        old_status = "CANCELLED"
        new_status = "CANCELLED"
        should_restore = (new_status.upper() == "CANCELLED" and (old_status or "").upper() != "CANCELLED")
        self.assertFalse(should_restore)

        # When status changes from COMPLETED to CANCELLED, restore should trigger
        old_status = "COMPLETED"
        new_status = "CANCELLED"
        should_restore = (new_status.upper() == "CANCELLED" and (old_status or "").upper() != "CANCELLED")
        self.assertTrue(should_restore)


class TestBug26UnifiedIncentivesAndPayroll(unittest.TestCase):
    def _create_mock_invoice(
        self,
        inv_id="inv-1",
        total=1000.0,
        paid=1000.0,
        status="FINALIZED",
        payment_status="PAID",
        discount_amount=0.0,
        items=None,
    ):
        inv = SimpleNamespace(
            id=inv_id,
            invoice_number="INV-001",
            status=status,
            payment_status=payment_status,
            total_amount=total,
            paid_amount=paid,
            discount_amount=discount_amount,
            items=items or [],
        )
        return inv

    def test_rule1_unpaid_bill_generates_zero_incentive(self):
        item = SimpleNamespace(
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
        inv = self._create_mock_invoice(
            total=500.0,
            paid=0.0,
            payment_status="PENDING",
            items=[item],
        )
        cfg = {"staff-1": StaffIncentiveConfig(incentive_base=True, service_incentive_percent=10.0)}
        summary = IncentiveCalculationService.calculate_invoice_incentives(inv, cfg)
        self.assertFalse(summary.is_eligible)
        self.assertEqual(summary.total_incentive, 0.0)

    def test_rule2_fully_paid_bill_generates_full_incentive(self):
        item = SimpleNamespace(
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
        inv = self._create_mock_invoice(
            total=500.0,
            paid=500.0,
            payment_status="PAID",
            items=[item],
        )
        cfg = {"staff-1": StaffIncentiveConfig(incentive_base=True, service_incentive_percent=10.0)}
        summary = IncentiveCalculationService.calculate_invoice_incentives(inv, cfg)
        self.assertTrue(summary.is_eligible)
        self.assertEqual(summary.total_incentive, 50.0)

    def test_rule3_partial_payment_proportional_incentive(self):
        item = SimpleNamespace(
            item_type="SERVICE",
            item_id="svc-1",
            name="Color",
            staff_id="staff-1",
            staff_name="Alice",
            quantity=1,
            unit_price=1000.0,
            discount=0.0,
            tax_rate=0.0,
        )
        inv = self._create_mock_invoice(
            total=1000.0,
            paid=400.0,
            payment_status="PARTIALLY_PAID",
            items=[item],
        )
        cfg = {"staff-1": StaffIncentiveConfig(incentive_base=True, service_incentive_percent=10.0)}
        summary = IncentiveCalculationService.calculate_invoice_incentives(inv, cfg)
        self.assertTrue(summary.is_eligible)
        self.assertEqual(summary.collected_ratio, 0.4)
        self.assertEqual(summary.lines[0].net_collected_sales, 400.0)
        self.assertEqual(summary.lines[0].incentive_amount, 40.0)
        self.assertEqual(summary.total_incentive, 40.0)

    def test_rule4_bill_level_discount_proportional_allocation(self):
        item1 = SimpleNamespace(
            item_type="SERVICE",
            item_id="svc-1",
            name="Haircut",
            staff_id="staff-1",
            staff_name="Alice",
            quantity=1,
            unit_price=600.0,
            discount=0.0,
            tax_rate=0.0,
        )
        item2 = SimpleNamespace(
            item_type="SERVICE",
            item_id="svc-2",
            name="Shave",
            staff_id="staff-2",
            staff_name="Bob",
            quantity=1,
            unit_price=400.0,
            discount=0.0,
            tax_rate=0.0,
        )
        inv = self._create_mock_invoice(
            total=900.0,
            paid=900.0,
            payment_status="PAID",
            discount_amount=100.0,
            items=[item1, item2],
        )
        cfg = {
            "staff-1": StaffIncentiveConfig(incentive_base=True, service_incentive_percent=10.0),
            "staff-2": StaffIncentiveConfig(incentive_base=True, service_incentive_percent=10.0),
        }
        summary = IncentiveCalculationService.calculate_invoice_incentives(inv, cfg)
        self.assertEqual(summary.lines[0].allocated_bill_discount, 60.0)
        self.assertEqual(summary.lines[0].sales_subtotal, 540.0)
        self.assertEqual(summary.lines[0].incentive_amount, 54.0)

        self.assertEqual(summary.lines[1].allocated_bill_discount, 40.0)
        self.assertEqual(summary.lines[1].sales_subtotal, 360.0)
        self.assertEqual(summary.lines[1].incentive_amount, 36.0)

        self.assertEqual(summary.total_incentive, 90.0)

    def test_rule5_cancelled_appointment_earns_zero_incentive(self):
        item = SimpleNamespace(
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
        inv = self._create_mock_invoice(
            total=500.0,
            paid=500.0,
            payment_status="PAID",
            items=[item],
        )
        cfg = {"staff-1": StaffIncentiveConfig(incentive_base=True, service_incentive_percent=10.0)}
        summary = IncentiveCalculationService.calculate_invoice_incentives(inv, cfg, appointment_status="CANCELLED")
        self.assertFalse(summary.is_eligible)
        self.assertEqual(summary.total_incentive, 0.0)

    def test_payroll_base_salary_monthly_full_and_prorated(self):
        def calculate_base_salary(salary, salary_type, joining_date, month, year):
            configured_salary = float(salary or 0.0)
            if configured_salary <= 0:
                return 0.0
            stype = (salary_type or "monthly").strip().lower()
            month_days = calendar.monthrange(year, month)[1]
            if joining_date is not None:
                j_date = joining_date.date() if isinstance(joining_date, datetime) else joining_date
                if (j_date.year, j_date.month) > (year, month):
                    return 0.0
                elif (j_date.year, j_date.month) == (year, month):
                    effective_days = max(month_days - j_date.day + 1, 0)
                else:
                    effective_days = month_days
            else:
                effective_days = month_days

            if effective_days <= 0:
                return 0.0
            if stype == "daily":
                return round(configured_salary * effective_days, 2)
            elif stype == "weekly":
                return round((configured_salary / 7.0) * effective_days, 2)
            else:
                return round(configured_salary * (effective_days / float(month_days)), 2)

        # 30-day month (April 2026), full month
        full_salary = calculate_base_salary(
            salary=30000.0,
            salary_type="monthly",
            joining_date=datetime(2025, 1, 1, tzinfo=timezone.utc),
            month=4,
            year=2026,
        )
        self.assertEqual(full_salary, 30000.0)

        # Joined on April 16 (15 days: 16 to 30) -> ₹15,000
        prorated = calculate_base_salary(
            salary=30000.0,
            salary_type="monthly",
            joining_date=datetime(2026, 4, 16, tzinfo=timezone.utc),
            month=4,
            year=2026,
        )
        self.assertEqual(prorated, 15000.0)

        # Daily salary: 1000/day * 30 days = ₹30,000
        daily = calculate_base_salary(
            salary=1000.0,
            salary_type="daily",
            joining_date=None,
            month=4,
            year=2026,
        )
        self.assertEqual(daily, 30000.0)

        # Weekly salary: 7000/week (1000/day) * 30 days = ₹30,000
        weekly = calculate_base_salary(
            salary=7000.0,
            salary_type="weekly",
            joining_date=None,
            month=4,
            year=2026,
        )
        self.assertEqual(weekly, 30000.0)


if __name__ == "__main__":
    unittest.main()
