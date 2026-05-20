from typing import List, Optional
from app.models.billing import Invoice, Payment
from app.repositories.base import BaseRepository

class InvoiceRepository(BaseRepository[Invoice]):
    def __init__(self) -> None:
        super().__init__(Invoice)

    async def get_by_number(self, invoice_number: str) -> Optional[Invoice]:
        """Fetches an invoice by its unique invoice number constraint."""
        filters = {"invoice_number": invoice_number}
        results = await self.list(filters=filters, limit=1)
        return results[0] if results else None

    async def get_customer_invoices(self, customer_id: str) -> List[Invoice]:
        """Gets all invoices issued to a specific client."""
        filters = {"customer_id": customer_id}
        return await self.list(filters=filters, limit=100, sort="-created_at")


class PaymentRepository(BaseRepository[Payment]):
    def __init__(self) -> None:
        super().__init__(Payment)

    async def get_invoice_payments(self, invoice_id: str) -> List[Payment]:
        """Gets all payments recorded against a single invoice."""
        filters = {"invoice_id": invoice_id}
        return await self.list(filters=filters, limit=50, sort="payment_date")
