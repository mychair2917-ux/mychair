"""
Unified Incentive Calculation Service.

Shared calculation engine used across:
- Billing & Invoices
- My Earnings
- Salon Earnings
- Payroll

Implements the 13 approved business rules:
1. Uses actual final service price (including manual overrides)
2. Applies correct service and product incentive rates
3. Handles service-level discounts correctly
4. Allocates bill-level discounts proportionally across line items
5. Attributes incentives to the correct staff member
6. Does not generate earned incentives on unpaid bills
7. Handles partial payments proportionally against collected eligible revenue
8. Prevents duplicate incentives
9. Recalculates correctly after bill editing
10. Handles cancellation and refunds consistently
11. Preserves historical incentive rates and amounts
12. Ensures Payroll, My Earnings and Salon Earnings produce consistent results
13. Uses consistent 2-decimal currency precision
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, List, Optional

try:
    from app.models.billing import Invoice, Payment
except Exception:
    Invoice = Any
    Payment = Any


@dataclass
class StaffIncentiveConfig:
    incentive_base: bool = False
    service_incentive_percent: float = 0.0
    product_incentive_percent: float = 0.0


@dataclass
class LineIncentiveBreakdown:
    item_type: str  # "SERVICE" or "PRODUCT"
    item_id: str
    item_name: str
    staff_id: Optional[str]
    staff_name: Optional[str]
    quantity: int
    unit_price: float
    line_gross: float
    line_discount: float
    allocated_bill_discount: float
    total_line_discount: float
    sales_subtotal: float
    net_collected_sales: float
    incentive_rate_pct: float
    incentive_amount: float
    refund_amount: float


@dataclass
class InvoiceIncentiveSummary:
    invoice_id: str
    is_eligible: bool
    collected_ratio: float
    refund_ratio: float
    net_collection_ratio: float
    total_service_incentive: float
    total_product_incentive: float
    total_incentive: float
    lines: List[LineIncentiveBreakdown]


class IncentiveCalculationService:
    """Canonical service for calculating sales and staff incentives."""

    @staticmethod
    def is_invoice_eligible(
        invoice_status: str,
        payment_status: str,
        paid_amount: float,
        appointment_status: Optional[str] = None,
    ) -> bool:
        if (invoice_status or "").upper() == "VOIDED":
            return False
        if appointment_status and appointment_status.upper() == "CANCELLED":
            return False
        p_status = (payment_status or "").upper()
        if p_status in {"PENDING", "UNPAID"} and paid_amount <= 0:
            return False
        return True

    @staticmethod
    def calculate_ratios(
        total_amount: float,
        paid_amount: float,
        payment_status: str,
        total_refunded: float = 0.0,
    ) -> tuple[float, float, float]:
        if total_amount <= 0:
            return 0.0, 0.0, 0.0

        p_status = (payment_status or "").upper()
        if p_status == "PAID" or paid_amount >= total_amount:
            collected_ratio = 1.0
        elif p_status in {"PENDING", "UNPAID"} and paid_amount <= 0:
            collected_ratio = 0.0
        else:
            collected_ratio = min(max(paid_amount / total_amount, 0.0), 1.0)

        refund_ratio = min(max(total_refunded / total_amount, 0.0), 1.0) if total_refunded > 0 else 0.0
        net_collection_ratio = max(collected_ratio - refund_ratio, 0.0)
        return collected_ratio, refund_ratio, net_collection_ratio

    @classmethod
    def calculate_invoice_incentives(
        cls,
        invoice: Invoice,
        staff_configs: Dict[str, StaffIncentiveConfig],
        appointment_status: Optional[str] = None,
        payments: Optional[List[Payment]] = None,
    ) -> InvoiceIncentiveSummary:
        invoice_status = (invoice.status or "").upper()
        payment_status = (invoice.payment_status or "").upper()
        total_amount = float(invoice.total_amount or 0.0)
        paid_amount = float(invoice.paid_amount or 0.0)

        total_refunded = 0.0
        if payments:
            total_refunded = sum(max(float(p.refunded_amount or 0.0), 0.0) for p in payments)

        eligible = cls.is_invoice_eligible(invoice_status, payment_status, paid_amount, appointment_status)

        collected_ratio, refund_ratio, net_collection_ratio = cls.calculate_ratios(
            total_amount, paid_amount, payment_status, total_refunded
        )

        lines: List[LineIncentiveBreakdown] = []
        tot_svc_inc = 0.0
        tot_prod_inc = 0.0

        if not eligible or net_collection_ratio <= 0:
            for item in invoice.items:
                qty = max(int(item.quantity or 1), 1)
                u_price = float(item.unit_price or 0.0)
                gross = round(u_price * qty, 2)
                subtotal = round(max(gross - float(item.discount or 0.0), 0.0), 2)
                lines.append(
                    LineIncentiveBreakdown(
                        item_type=item.item_type,
                        item_id=item.item_id,
                        item_name=item.name,
                        staff_id=item.staff_id,
                        staff_name=item.staff_name,
                        quantity=qty,
                        unit_price=u_price,
                        line_gross=gross,
                        line_discount=float(item.discount or 0.0),
                        allocated_bill_discount=0.0,
                        total_line_discount=float(item.discount or 0.0),
                        sales_subtotal=subtotal,
                        net_collected_sales=0.0,
                        incentive_rate_pct=0.0,
                        incentive_amount=0.0,
                        refund_amount=0.0,
                    )
                )
            return InvoiceIncentiveSummary(
                invoice_id=str(invoice.id),
                is_eligible=False,
                collected_ratio=collected_ratio,
                refund_ratio=refund_ratio,
                net_collection_ratio=net_collection_ratio,
                total_service_incentive=0.0,
                total_product_incentive=0.0,
                total_incentive=0.0,
                lines=lines,
            )

        # Proportional allocation of bill-level discount across lines
        total_items_gross = sum(
            max(float(it.unit_price or 0.0) * max(int(it.quantity or 1), 1), 0.0)
            for it in invoice.items
        )
        bill_discount = float(invoice.discount_amount or 0.0)

        for item in invoice.items:
            qty = max(int(item.quantity or 1), 1)
            u_price = float(item.unit_price or 0.0)
            gross = round(u_price * qty, 2)
            svc_disc = float(item.discount or 0.0)

            allocated_bill_disc = 0.0
            if bill_discount > 0 and total_items_gross > 0:
                allocated_bill_disc = round(bill_discount * (gross / total_items_gross), 2)

            total_disc = round(svc_disc + allocated_bill_disc, 2)
            subtotal = round(max(gross - total_disc, 0.0), 2)
            net_collected = round(subtotal * net_collection_ratio, 2)
            item_refund = round(subtotal * refund_ratio, 2)

            inc_rate = 0.0
            inc_amount = 0.0
            if item.staff_id and item.staff_id in staff_configs:
                cfg = staff_configs[item.staff_id]
                if cfg.incentive_base:
                    inc_rate = (
                        cfg.service_incentive_percent
                        if item.item_type == "SERVICE"
                        else cfg.product_incentive_percent
                    )
                    if inc_rate > 0 and net_collected > 0:
                        inc_amount = round(net_collected * (inc_rate / 100.0), 2)

            if item.item_type == "SERVICE":
                tot_svc_inc = round(tot_svc_inc + inc_amount, 2)
            else:
                tot_prod_inc = round(tot_prod_inc + inc_amount, 2)

            lines.append(
                LineIncentiveBreakdown(
                    item_type=item.item_type,
                    item_id=item.item_id,
                    item_name=item.name,
                    staff_id=item.staff_id,
                    staff_name=item.staff_name,
                    quantity=qty,
                    unit_price=u_price,
                    line_gross=gross,
                    line_discount=svc_disc,
                    allocated_bill_discount=allocated_bill_disc,
                    total_line_discount=total_disc,
                    sales_subtotal=subtotal,
                    net_collected_sales=net_collected,
                    incentive_rate_pct=inc_rate,
                    incentive_amount=inc_amount,
                    refund_amount=item_refund,
                )
            )

        total_inc = round(tot_svc_inc + tot_prod_inc, 2)
        return InvoiceIncentiveSummary(
            invoice_id=str(invoice.id),
            is_eligible=True,
            collected_ratio=collected_ratio,
            refund_ratio=refund_ratio,
            net_collection_ratio=net_collection_ratio,
            total_service_incentive=tot_svc_inc,
            total_product_incentive=tot_prod_inc,
            total_incentive=total_inc,
            lines=lines,
        )


incentive_service = IncentiveCalculationService()
