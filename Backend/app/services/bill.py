from typing import List, Dict, Any, Optional
from app.models.bill import Bill, BillItem
from app.utils.timezone import now_utc


class BillService:

    async def _generate_bill_number(self, salon_id: str) -> str:
        """Generates a unique bill number per salon: BILL-{SALON_SHORT}-{SEQ:04d}."""
        count = await Bill.find(
            {"salon_id": salon_id, "is_deleted": False}
        ).count()
        salon_short = salon_id[-4:].upper()
        return f"BILL-{salon_short}-{str(count + 1).zfill(4)}"

    async def create_bill_from_appointment(
        self,
        appointment_id: str,
        salon_id: str,
        salon_name: str,
        salon_phone: str,
        salon_address: str,
        customer_id: str,
        customer_name: str,
        customer_phone: str,
        services: List[Dict[str, Any]],
        products: List[Dict[str, Any]],
        payment_status: str,
        payment_method: Optional[str],
        total_amount: float,
        paid_amount: float,
    ) -> Bill:
        """
        Auto-creates a Bill record when an appointment is submitted.
        Snapshots all salon info, customer details, and line items permanently.
        """
        items: List[BillItem] = []
        subtotal = 0.0
        tax_amount = 0.0

        # Build SERVICE line items
        for svc in services:
            unit_price = float(svc.get("price", 0.0))
            tax_rate = float(svc.get("tax_rate", 0.0))
            line_tax = round(unit_price * (tax_rate / 100.0), 2)
            line_total = round(unit_price + line_tax, 2)

            subtotal += unit_price
            tax_amount += line_tax

            items.append(BillItem(
                item_type="SERVICE",
                item_id=svc.get("service_id", ""),
                name=svc.get("name", "Service"),
                quantity=1,
                unit_price=unit_price,
                tax_rate=tax_rate,
                tax_amount=line_tax,
                staff_id=svc.get("staff_id"),
                staff_name=svc.get("staff_name"),
                line_total=line_total,
            ))

        # Build PRODUCT line items
        for prod in products:
            unit_price = float(prod.get("price", 0.0))
            tax_rate = float(prod.get("tax_rate", 0.0))
            line_tax = round(unit_price * (tax_rate / 100.0), 2)
            line_total = round(unit_price + line_tax, 2)

            subtotal += unit_price
            tax_amount += line_tax

            items.append(BillItem(
                item_type="PRODUCT",
                item_id=prod.get("product_id", ""),
                name=prod.get("name", "Product"),
                quantity=1,
                unit_price=unit_price,
                tax_rate=tax_rate,
                tax_amount=line_tax,
                staff_id=prod.get("staff_id"),
                staff_name=prod.get("staff_name"),
                line_total=line_total,
            ))

        computed_total = total_amount if total_amount > 0 else round(subtotal + tax_amount, 2)

        # Resolve paid/remaining amounts based on payment status
        if payment_status == "PAID":
            effective_paid = computed_total
            remaining = 0.0
        elif payment_status == "PENDING":
            effective_paid = 0.0
            remaining = computed_total
        else:  # PARTIALLY_PAID
            effective_paid = min(paid_amount, computed_total)
            remaining = round(computed_total - effective_paid, 2)

        bill_number = await self._generate_bill_number(salon_id)

        bill = Bill(
            salon_id=salon_id,
            appointment_id=appointment_id,
            salon_name=salon_name,
            salon_phone=salon_phone,
            salon_address=salon_address,
            customer_id=customer_id,
            customer_name=customer_name,
            customer_phone=customer_phone,
            bill_number=bill_number,
            category="APPOINTMENT",
            items=items,
            subtotal=round(subtotal, 2),
            tax_amount=round(tax_amount, 2),
            discount_amount=0.0,
            total_amount=computed_total,
            paid_amount=round(effective_paid, 2),
            remaining_amount=remaining,
            payment_status=payment_status,
            payment_method=payment_method,
            bill_date=now_utc(),
        )
        await bill.insert()
        return bill
