from datetime import datetime
from typing import List, Optional, Dict, Any
from app.models.billing import Invoice, InvoiceItem, Payment, build_payment_history_note
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

    @staticmethod
    def _build_billing_whatsapp_payload(
        template_name: str,
        client_name: Optional[str],
        salon_name: Optional[str],
        invoice_number: Optional[str] = None,
        total_amount: Optional[float] = None,
        document_url: Optional[str] = None,
        document_filename: Optional[str] = None,
    ) -> tuple[Optional[Dict[str, Any]], Optional[List[Dict[str, Any]]]]:
        """
        Builds template variables and Meta components for outbound billing WhatsApp templates.
        Supports:
          - 'service_completion_thank_you' (body named parameters, no PDF header)
          - 'service_completion_thank_you_with_bill' (document header with invoice PDF + body named parameters)
          - 'hello_world' (no variables)
        """
        if template_name in ("service_completion_thank_you", "service_completion_thank_you_with_bill"):
            actual_client = (client_name or "").strip() or "Valued Customer"
            actual_salon = (salon_name or "").strip() or "Salon"
            actual_salon_repeat = actual_salon

            template_variables = {
                "client_name": actual_client,
                "salon_name": actual_salon,
                "salon_name_repeat": actual_salon_repeat,
            }

            components: List[Dict[str, Any]] = []

            # Document header component for PDF billing template
            if template_name == "service_completion_thank_you_with_bill":
                doc_param: Dict[str, Any] = {}
                if document_url:
                    doc_param["link"] = document_url
                if document_filename:
                    doc_param["filename"] = document_filename
                elif invoice_number:
                    doc_param["filename"] = f"{invoice_number}.pdf"
                else:
                    doc_param["filename"] = "invoice.pdf"

                components.append({
                    "type": "header",
                    "parameters": [
                        {
                            "type": "document",
                            "document": doc_param,
                        }
                    ],
                })

            # Body component with named parameters
            components.append({
                "type": "body",
                "parameters": [
                    {
                        "type": "text",
                        "parameter_name": "client_name",
                        "text": actual_client,
                    },
                    {
                        "type": "text",
                        "parameter_name": "salon_name",
                        "text": actual_salon,
                    },
                    {
                        "type": "text",
                        "parameter_name": "salon_name_repeat",
                        "text": actual_salon_repeat,
                    },
                ],
            })
            return template_variables, components
        elif template_name == "hello_world":
            return None, None
        else:
            # Fallback for custom templates
            template_variables = {
                "1": client_name or "Valued Customer",
                "2": salon_name or "Salon",
                "3": invoice_number or "",
                "4": f"{total_amount:.2f}" if total_amount is not None else "0.00",
            }
            return template_variables, None

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
        notes: Optional[str] = None,
        send_whatsapp: bool = False,
        send_bill_pdf: bool = False,
    ) -> Invoice:
        """
        Auto-creates a finalized invoice from an appointment submission.
        Snapshots all appointment data permanently — no manual entry needed.
        """
        if appointment_id:
            existing = await Invoice.find_one(
                {"appointment_id": appointment_id, "is_deleted": False}
            )
            if existing:
                return await self.update_invoice_from_appointment(
                    appointment_id=appointment_id,
                    salon_id=salon_id,
                    salon_name=salon_name,
                    salon_phone=salon_phone,
                    salon_address=salon_address,
                    customer_id=customer_id,
                    customer_name=customer_name,
                    customer_phone=customer_phone,
                    services=services,
                    products=products,
                    payment_status=payment_status,
                    payment_method=payment_method,
                    total_amount=total_amount,
                    paid_amount=paid_amount,
                    notes=notes,
                    send_whatsapp=send_whatsapp,
                    send_bill_pdf=send_bill_pdf,
                )

        invoice_number = await self._generate_invoice_number(salon_id)
        invoice_items: List[InvoiceItem] = []
        subtotal = 0.0
        tax_amount = 0.0
        discount_amount = 0.0

        for svc in services:
            applied_price = float(svc.get("price", 0.0))
            discount = float(svc.get("discount", 0.0))
            unit_price = float(svc.get("unit_price") or (applied_price + discount))
            tax_rate = float(svc.get("tax_rate", 0.0))
            line_subtotal = (unit_price * 1) - discount
            line_tax = line_subtotal * (tax_rate / 100.0)
            subtotal += unit_price
            discount_amount += discount
            tax_amount += line_tax
            invoice_items.append(
                InvoiceItem(
                    item_type="SERVICE",
                    item_id=svc.get("service_id", ""),
                    name=svc.get("name", "Service"),
                    quantity=1,
                    unit_price=unit_price,
                    tax_rate=tax_rate,
                    discount=discount,
                    staff_id=svc.get("staff_id"),
                    staff_name=svc.get("staff_name"),
                )
            )

        for prod in products:
            applied_price = float(prod.get("price", 0.0))
            discount = float(prod.get("discount", 0.0))
            unit_price = float(prod.get("unit_price") or (applied_price + discount))
            tax_rate = float(prod.get("tax_rate", 0.0))
            try:
                quantity = int(prod.get("quantity") or 1)
            except (TypeError, ValueError):
                quantity = 1
            quantity = max(1, quantity)
            line_subtotal = (unit_price * quantity) - discount
            line_tax = line_subtotal * (tax_rate / 100.0)
            subtotal += unit_price * quantity
            discount_amount += discount
            tax_amount += line_tax
            invoice_items.append(
                InvoiceItem(
                    item_type="PRODUCT",
                    item_id=prod.get("product_id") or prod.get("id", ""),
                    salon_product_id=prod.get("salon_product_id"),
                    brand_id=prod.get("brand_id"),
                    name=prod.get("name", "Product"),
                    quantity=quantity,
                    unit_price=unit_price,
                    tax_rate=tax_rate,
                    discount=discount,
                    staff_id=prod.get("staff_id"),
                    staff_name=prod.get("staff_name"),
                )
            )

        computed_total = round((subtotal - discount_amount) + tax_amount, 2)
        effective_total = float(total_amount) if total_amount is not None else computed_total
        effective_paid = float(paid_amount) if paid_amount is not None else effective_total
        remaining = max(0.0, effective_total - effective_paid)

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
            notes=notes,
            items=invoice_items,
            subtotal=round(subtotal, 2),
            tax_amount=round(tax_amount, 2),
            discount_amount=round(discount_amount, 2),
            total_amount=round(effective_total, 2),
            paid_amount=round(effective_paid, 2),
            remaining_amount=round(remaining, 2),
            finalized_at=now_utc(),
        )
        await invoice.insert()

        # Record initial paid amount in the payment ledger (partial or full).
        if effective_paid > 0:
            installment_number = 1
            note = build_payment_history_note(
                status_before="PENDING",
                status_after=payment_status,
                installment_number=installment_number,
                amount=round(effective_paid, 2),
                remaining_after=round(remaining, 2),
            )
            payment = Payment(
                invoice_id=str(invoice.id),
                salon_id=salon_id,
                amount=round(effective_paid, 2),
                payment_method=payment_method or "CASH",
                status="SUCCESSFUL",
                note=note,
                installment_number=installment_number,
                status_after=payment_status,
                paid_amount_after=round(effective_paid, 2),
                remaining_amount_after=round(remaining, 2),
                payment_date=now_utc(),
            )
            await payment.insert()

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

        # Decoupled WhatsApp notification trigger — billing completion is never blocked by WhatsApp failures
        effective_send_whatsapp = bool(send_whatsapp)
        effective_send_bill_pdf = bool(send_bill_pdf) if effective_send_whatsapp else False

        if not effective_send_whatsapp:
            import logging
            logging.getLogger("billing").info(
                "WhatsApp billing notification skipped for invoice %s (send_whatsapp is False)",
                invoice.id,
            )
            return invoice

        try:
            from app.core.config import settings
            from app.services.whatsapp import whatsapp_service

            creds = await whatsapp_service.resolve_sender_credentials(salon_id)
            if creds.is_valid:
                account = creds.salon_account if creds.sender_type == "SALON" else None
                if not account or account.features.get("billing_enabled", True):
                    # Template selection
                    if not effective_send_bill_pdf:
                        template_name = settings.WHATSAPP_BILLING_TEMPLATE or "service_completion_thank_you"
                        attachment_type = "NONE"
                        document_url = None
                    else:
                        template_name = settings.WHATSAPP_BILLING_PDF_TEMPLATE or "service_completion_thank_you_with_bill"
                        attachment_type = "BILL_PDF"
                        # Generate actual invoice PDF
                        from app.services.invoice_pdf import InvoicePDFService
                        pdf_svc = InvoicePDFService()
                        document_url = await pdf_svc.ensure_invoice_pdf_url(invoice)

                    if creds.sender_type == "SALON" and account and account.templates:
                        custom_key = "bill_receipt_pdf" if effective_send_bill_pdf else "bill_receipt"
                        if custom_key in account.templates:
                            template_name = account.templates.get(custom_key, template_name)

                    real_client_name = (customer_name or invoice.customer_name or "").strip()
                    if not real_client_name and customer_id:
                        try:
                            from app.models.customer import Customer
                            from beanie import PydanticObjectId
                            cust = await Customer.find_one({"_id": PydanticObjectId(customer_id), "is_deleted": False})
                            if cust:
                                real_client_name = (cust.full_name or cust.first_name or "").strip()
                        except Exception:
                            pass

                    real_salon_name = (salon_name or invoice.salon_name or "").strip()
                    if not real_salon_name and salon_id:
                        try:
                            from app.models.salon import Salon
                            from beanie import PydanticObjectId
                            sal = await Salon.find_one({"_id": PydanticObjectId(salon_id), "is_deleted": False})
                            if sal and sal.name:
                                real_salon_name = sal.name.strip()
                        except Exception:
                            pass

                    template_variables, components = self._build_billing_whatsapp_payload(
                        template_name=template_name,
                        client_name=real_client_name,
                        salon_name=real_salon_name,
                        invoice_number=invoice.invoice_number,
                        total_amount=invoice.total_amount,
                        document_url=document_url,
                        document_filename=f"{invoice.invoice_number}.pdf",
                    )

                    await whatsapp_service.send_template_message(
                        salon_id=salon_id,
                        customer_id=customer_id,
                        recipient_phone=customer_phone,
                        message_type="BILL_RECEIPT",
                        template_name=template_name,
                        template_variables=template_variables,
                        components=components,
                        reference_type="BILL",
                        reference_id=str(invoice.id),
                        attachment_type=attachment_type,
                    )
        except Exception as exc:
            import logging
            logging.getLogger("billing").warning(
                "WhatsApp bill notification async dispatch exception for invoice %s (payment remains successful): %s",
                invoice.id,
                exc,
            )

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
            "paid_amount": 0.0
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

        # Decoupled WhatsApp notification trigger on draft invoice finalization
        try:
            from app.core.config import settings
            from app.services.whatsapp import whatsapp_service

            creds = await whatsapp_service.resolve_sender_credentials(invoice.salon_id)
            if creds.is_valid and invoice.customer_phone:
                account = creds.salon_account if creds.sender_type == "SALON" else None
                if not account or account.features.get("billing_enabled", True):
                    template_name = settings.WHATSAPP_BILLING_TEMPLATE or "hello_world"
                    if creds.sender_type == "SALON" and account and account.templates and "bill_receipt" in account.templates:
                        template_name = account.templates.get("bill_receipt", template_name)

                    real_client_name = (invoice.customer_name or "").strip()
                    if not real_client_name and invoice.customer_id:
                        try:
                            from app.models.customer import Customer
                            from beanie import PydanticObjectId
                            cust = await Customer.find_one({"_id": PydanticObjectId(invoice.customer_id), "is_deleted": False})
                            if cust:
                                real_client_name = (cust.full_name or cust.first_name or "").strip()
                        except Exception:
                            pass

                    real_salon_name = (invoice.salon_name or "").strip()
                    if not real_salon_name and invoice.salon_id:
                        try:
                            from app.models.salon import Salon
                            from beanie import PydanticObjectId
                            sal = await Salon.find_one({"_id": PydanticObjectId(invoice.salon_id), "is_deleted": False})
                            if sal and sal.name:
                                real_salon_name = sal.name.strip()
                        except Exception:
                            pass

                    template_variables, components = self._build_billing_whatsapp_payload(
                        template_name=template_name,
                        client_name=real_client_name,
                        salon_name=real_salon_name,
                        invoice_number=invoice.invoice_number,
                        total_amount=invoice.total_amount,
                    )

                    await whatsapp_service.send_template_message(
                        salon_id=invoice.salon_id,
                        customer_id=invoice.customer_id,
                        recipient_phone=invoice.customer_phone,
                        message_type="BILL_RECEIPT",
                        template_name=template_name,
                        template_variables=template_variables,
                        components=components,
                        reference_type="BILL",
                        reference_id=str(invoice.id),
                    )
        except Exception as exc:
            import logging
            logging.getLogger("billing").warning(
                "WhatsApp bill notification dispatch exception on finalize for invoice %s (invoice remains finalized): %s",
                invoice.id,
                exc,
            )

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
            
        remaining_balance = invoice.total_amount - invoice.paid_amount
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
        invoice.paid_amount += amount
        if invoice.paid_amount >= invoice.total_amount - 0.01:
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
        invoice.paid_amount -= amount
        if invoice.status == "PAID" and invoice.paid_amount < invoice.total_amount:
            invoice.status = "FINALIZED"
        await invoice.save()
        
        return payment

    async def update_invoice_from_appointment(
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
        notes: Optional[str] = None,
        send_whatsapp: bool = False,
        send_bill_pdf: bool = False,
    ) -> Optional[Invoice]:
        """
        Updates an existing Invoice record when an appointment is edited.
        """
        invoice = await Invoice.find_one(
            {"appointment_id": appointment_id, "is_deleted": False}
        )
        if not invoice:
            return await self.create_invoice_from_appointment(
                appointment_id=appointment_id,
                salon_id=salon_id,
                salon_name=salon_name,
                salon_phone=salon_phone,
                salon_address=salon_address,
                customer_id=customer_id,
                customer_name=customer_name,
                customer_phone=customer_phone,
                services=services,
                products=products,
                payment_status=payment_status,
                payment_method=payment_method,
                total_amount=total_amount,
                paid_amount=paid_amount,
                notes=notes,
                send_whatsapp=send_whatsapp,
                send_bill_pdf=send_bill_pdf,
            )

        invoice_items: List[InvoiceItem] = []
        subtotal = 0.0
        tax_amount = 0.0
        discount_amount = 0.0

        for svc in services:
            applied_price = float(svc.get("price", 0.0))
            discount = float(svc.get("discount", 0.0))
            unit_price = float(svc.get("unit_price") or (applied_price + discount))
            tax_rate = float(svc.get("tax_rate", 0.0))
            line_subtotal = (unit_price * 1) - discount
            line_tax = line_subtotal * (tax_rate / 100.0)
            subtotal += unit_price
            discount_amount += discount
            tax_amount += line_tax
            invoice_items.append(
                InvoiceItem(
                    item_type="SERVICE",
                    item_id=svc.get("service_id", ""),
                    name=svc.get("name", "Service"),
                    quantity=1,
                    unit_price=unit_price,
                    tax_rate=tax_rate,
                    discount=discount,
                    staff_id=svc.get("staff_id"),
                    staff_name=svc.get("staff_name"),
                )
            )

        for prod in products:
            applied_price = float(prod.get("price", 0.0))
            discount = float(prod.get("discount", 0.0))
            unit_price = float(prod.get("unit_price") or (applied_price + discount))
            tax_rate = float(prod.get("tax_rate", 0.0))
            try:
                quantity = int(prod.get("quantity") or 1)
            except (TypeError, ValueError):
                quantity = 1
            if quantity < 1:
                quantity = 1
            line_subtotal = (unit_price * quantity) - discount
            line_tax = line_subtotal * (tax_rate / 100.0)
            subtotal += unit_price * quantity
            discount_amount += discount
            tax_amount += line_tax
            invoice_items.append(
                InvoiceItem(
                    item_type="PRODUCT",
                    item_id=prod.get("product_id", ""),
                    salon_product_id=prod.get("salon_product_id"),
                    brand_id=prod.get("brand_id"),
                    name=prod.get("name", "Product"),
                    quantity=quantity,
                    unit_price=unit_price,
                    tax_rate=tax_rate,
                    discount=discount,
                    staff_id=prod.get("staff_id"),
                    staff_name=prod.get("staff_name"),
                )
            )

        computed_total = total_amount if total_amount > 0 else (subtotal - discount_amount + tax_amount)
        if payment_status == "PAID":
            effective_paid = computed_total
            remaining = 0.0
        elif payment_status == "PENDING":
            effective_paid = 0.0
            remaining = computed_total
        else:  # PARTIALLY_PAID
            effective_paid = min(paid_amount, computed_total)
            remaining = computed_total - effective_paid

        invoice.items = invoice_items
        invoice.subtotal = round(subtotal, 2)
        invoice.tax_amount = round(tax_amount, 2)
        invoice.discount_amount = round(discount_amount, 2)
        invoice.total_amount = round(computed_total, 2)
        invoice.paid_amount = round(effective_paid, 2)
        invoice.remaining_amount = round(remaining, 2)
        invoice.payment_status = payment_status
        invoice.payment_method = payment_method
        invoice.customer_id = customer_id
        if customer_name:
            invoice.customer_name = customer_name
        if customer_phone:
            invoice.customer_phone = customer_phone
        if notes is not None:
            invoice.notes = notes

        await invoice.save()
        return invoice

