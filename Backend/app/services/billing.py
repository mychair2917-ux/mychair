from datetime import datetime
from typing import List, Optional, Dict, Any
from app.models.billing import Invoice, InvoiceItem, Payment
from app.repositories.billing import InvoiceRepository, PaymentRepository
from app.core.exceptions import ResourceNotFoundException, ImmutableResourceException
from app.core import tenant_context
from app.services.inventory import InventoryService
from app.utils.timezone import now_utc

class BillingService:
    def __init__(self) -> None:
        self.invoice_repo = InvoiceRepository()
        self.payment_repo = PaymentRepository()
        self.inventory_service = InventoryService()

    async def _generate_invoice_number(self, salon_id: str) -> str:
        """Generates a unique invoice number per salon: INV-{SALON_SHORT}-{SEQ:04d}."""
        count = await Invoice.find(
            {"salon_id": salon_id, "is_deleted": False}
        ).count()
        salon_short = salon_id[-4:].upper()
        return f"INV-{salon_short}-{str(count + 1).zfill(4)}"

    async def create_invoice_from_appointment(
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
        payment_method: str,
        total_amount: float,
        paid_amount: float,
    ) -> Invoice:
        """
        Auto-creates a finalized invoice from an appointment submission.
        Snapshots all appointment data permanently — no manual entry needed.
        """
        invoice_items: List[InvoiceItem] = []
        subtotal = 0.0
        tax_amount = 0.0

        for svc in services:
            price = float(svc.get("price", 0.0))
            tax_rate = float(svc.get("tax_rate", 0.0))
            line_tax = price * (tax_rate / 100.0)
            subtotal += price
            tax_amount += line_tax
            invoice_items.append(
                InvoiceItem(
                    item_type="SERVICE",
                    item_id=svc.get("service_id", ""),
                    name=svc.get("name", "Service"),
                    quantity=1,
                    unit_price=price,
                    tax_rate=tax_rate,
                    discount=0.0,
                    staff_id=svc.get("staff_id"),
                    staff_name=svc.get("staff_name"),
                )
            )

        for prod in products:
            price = float(prod.get("price", 0.0))
            tax_rate = float(prod.get("tax_rate", 0.0))
            line_tax = price * (tax_rate / 100.0)
            subtotal += price
            tax_amount += line_tax
            invoice_items.append(
                InvoiceItem(
                    item_type="PRODUCT",
                    item_id=prod.get("product_id", ""),
                    salon_product_id=prod.get("salon_product_id"),
                    brand_id=prod.get("brand_id"),
                    name=prod.get("name", "Product"),
                    quantity=1,
                    unit_price=price,
                    tax_rate=tax_rate,
                    discount=0.0,
                    staff_id=prod.get("staff_id"),
                    staff_name=prod.get("staff_name"),
                )
            )

        computed_total = total_amount if total_amount > 0 else (subtotal + tax_amount)

        if payment_status == "PAID":
            effective_paid = computed_total
            remaining = 0.0
        elif payment_status == "PENDING":
            effective_paid = 0.0
            remaining = computed_total
        else:  # PARTIALLY_PAID
            effective_paid = min(paid_amount, computed_total)
            remaining = computed_total - effective_paid

        invoice_number = await self._generate_invoice_number(salon_id)

        invoice = Invoice(
            salon_id=salon_id,
            salon_name=salon_name,
            salon_phone=salon_phone,
            salon_address=salon_address,
            customer_id=customer_id,
            customer_name=customer_name,
            customer_phone=customer_phone,
            appointment_id=appointment_id,
            invoice_number=invoice_number,
            status="FINALIZED",
            payment_status=payment_status,
            payment_method=payment_method,
            items=invoice_items,
            subtotal=round(subtotal, 2),
            tax_amount=round(tax_amount, 2),
            discount_amount=0.0,
            total_amount=round(computed_total, 2),
            paid_amount=round(effective_paid, 2),
            remaining_amount=round(remaining, 2),
            finalized_at=now_utc(),
        )
        await invoice.insert()
        for item in invoice.items:
            if item.item_type != "PRODUCT":
                continue
            try:
                await self.inventory_service.deduct_sold_product(
                    salon_id=salon_id,
                    product_id=item.item_id,
                    brand_id=item.brand_id,
                    quantity=item.quantity,
                    reference_id=str(invoice.id),
                )
            except ResourceNotFoundException:
                continue
        return invoice

    async def create_draft_invoice(
        self,
        salon_id: str,
        customer_id: str,
        appointment_id: Optional[str],
        items_payload: List[Dict[str, Any]]
    ) -> Invoice:
        """
        Creates an invoice in DRAFT state.
        Allows editing until finalized.
        """
        invoice_items: List[InvoiceItem] = []
        subtotal = 0.0
        tax_amount = 0.0
        discount_amount = 0.0
        
        for item in items_payload:
            qty = item.get("quantity", 1)
            unit_price = item.get("unit_price", 0.0)
            disc = item.get("discount", 0.0)
            tax_rate = item.get("tax_rate", 0.0)
            
            line_subtotal = (unit_price * qty) - disc
            line_tax = line_subtotal * (tax_rate / 100.0)
            
            subtotal += line_subtotal
            tax_amount += line_tax
            discount_amount += disc
            
            invoice_items.append(
                InvoiceItem(
                    item_type=item.get("item_type", "SERVICE"),
                    item_id=item.get("item_id"),
                    name=item.get("name"),
                    quantity=qty,
                    unit_price=unit_price,
                    tax_rate=tax_rate,
                    discount=disc
                )
            )
            
        total_amount = subtotal + tax_amount
        
        # Generate elegant timestamped unique invoice number
        timestamp = datetime.now().strftime("%y%m%d%H%M%S")
        invoice_number = f"INV-{timestamp}"
        
        invoice_data = {
            "salon_id": salon_id,
            "customer_id": customer_id,
            "appointment_id": appointment_id,
            "invoice_number": invoice_number,
            "status": "DRAFT",
            "items": invoice_items,
            "subtotal": subtotal,
            "tax_amount": tax_amount,
            "discount_amount": discount_amount,
            "total_amount": total_amount,
            "amount_paid": 0.0
        }
        
        return await self.invoice_repo.create(invoice_data)

    async def finalize_invoice(self, invoice_id: str) -> Invoice:
        """
        Finalizes a draft invoice.
        Freezes calculations and transitions state to FINALIZED, blocking further line modifications.
        """
        invoice = await self.invoice_repo.get(invoice_id)
        if invoice.status != "DRAFT":
            raise ImmutableResourceException("Only DRAFT invoices can be finalized.")
            
        invoice.finalize()
        await invoice.save()
        return invoice

    async def record_payment(
        self,
        invoice_id: str,
        amount: float,
        payment_method: str,  # CASH, CARD, UPI, LOYALTY
        transaction_reference: Optional[str] = None
    ) -> Payment:
        """
        Records a transaction payment against a finalized invoice.
        Enforces balance validations and invoice immutability parameters.
        Supports split payments (e.g. paying cash + card).
        """
        invoice = await self.invoice_repo.get(invoice_id)
        
        # Enforce billing status checks
        if invoice.status == "DRAFT":
            raise ImmutableResourceException("Cannot record payment on a DRAFT invoice. Finalize it first.")
        if invoice.status in ["VOIDED", "PAID"]:
            raise ImmutableResourceException(f"Cannot apply payment to an invoice that is already {invoice.status}.")
            
        remaining_balance = invoice.total_amount - invoice.amount_paid
        if amount > remaining_balance + 0.01:  # Allow minimal float rounding delta
            raise ImmutableResourceException(f"Payment amount ${amount} exceeds outstanding balance ${remaining_balance:.2f}.")
            
        # Create separate, immutable payment log
        payment_data = {
            "invoice_id": invoice_id,
            "salon_id": invoice.salon_id,
            "amount": amount,
            "payment_method": payment_method,
            "status": "SUCCESSFUL",
            "transaction_reference": transaction_reference
        }
        payment = await self.payment_repo.create(payment_data)
        
        # Update invoice balance
        invoice.amount_paid += amount
        if invoice.amount_paid >= invoice.total_amount - 0.01:
            invoice.status = "PAID"
        await invoice.save()
        
        return payment

    async def record_refund(self, payment_id: str, amount: float, reason: Optional[str] = None) -> Payment:
        """
        Processes a full or partial refund for a recorded payment.
        Updates billing states and outstanding balances dynamically.
        """
        payment = await self.payment_repo.get(payment_id)
        if payment.status != "SUCCESSFUL":
            raise ImmutableResourceException("Can only refund successful payments.")
            
        max_refundable = payment.amount - payment.refunded_amount
        if amount > max_refundable:
            raise ImmutableResourceException(f"Cannot refund ${amount}. Maximum refundable remaining is ${max_refundable:.2f}")
            
        invoice = await self.invoice_repo.get(payment.invoice_id)
        
        # Update payment refund statistics
        payment.refunded_amount += amount
        payment.refund_reason = reason
        if payment.refunded_amount >= payment.amount:
            payment.status = "REFUNDED"
        await payment.save()
        
        # Update invoice statistics
        invoice.amount_paid -= amount
        if invoice.status == "PAID" and invoice.amount_paid < invoice.total_amount:
            invoice.status = "FINALIZED"
        await invoice.save()
        
        return payment
