from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from app.models.appointment import Appointment
from app.models.billing import Invoice, Payment
from app.repositories.base import BaseRepository
from app.core import tenant_context

class AppointmentRepository(BaseRepository[Appointment]):
    def __init__(self) -> None:
        super().__init__(Appointment)

    async def find_overlapping_appointment(
        self,
        staff_id: str,
        start_time: datetime,
        end_time: datetime,
        exclude_appointment_id: Optional[str] = None
    ) -> Optional[Appointment]:
        """
        Check for any overlapping active appointments for a specific stylist.
        Formula: (start_A < end_B) and (end_A > start_B)
        """
        filters = {
            "staff_id": staff_id,
            "status": {"$nin": ["CANCELLED", "NO_SHOW"]},
            "start_datetime": {"$lt": end_time},
            "end_datetime": {"$gt": start_time},
        }
        
        if exclude_appointment_id:
            filters["_id"] = {"$ne": exclude_appointment_id}
            
        appointments = await self.list(filters=filters, limit=1)
        return appointments[0] if appointments else None

    async def get_branch_calendar(
        self,
        salon_id: str,
        start_range: datetime,
        end_range: datetime,
        staff_id: Optional[str] = None
    ) -> List[Appointment]:
        """
        Fetches calendar items for a salon branch within a specified datetime window.
        """
        filters = {
            "salon_id": salon_id,
            "start_datetime": {"$gte": start_range},
            "end_datetime": {"$lte": end_range},
        }
        
        if staff_id:
            filters["staff_id"] = staff_id
            
        return await self.list(filters=filters, limit=1000, sort="start_datetime")

    async def get_customer_history(self, customer_id: str, limit: int = 50) -> List[Appointment]:
        """
        Fetches the complete historical appointments list of a client.
        """
        filters = {"customer_id": customer_id, "is_deleted": False}
        return await self.list(filters=filters, limit=limit, sort="-start_datetime")

    async def get_customer_history_for_salon(
        self,
        customer_id: str,
        salon_id: Optional[str],
        limit: int = 50,
    ) -> List[Appointment]:
        """
        Fetches the client's appointment history, optionally constrained to a specific salon.
        """
        filters: Dict[str, Any] = {
            "customer_id": customer_id,
            "is_deleted": False,
        }
        if salon_id:
            filters["salon_id"] = salon_id
        return await self.list(filters=filters, limit=limit, sort="-start_datetime")

    async def get_appointment_invoice(self, appointment_id: str) -> Optional[Invoice]:
        filters = {"appointment_id": appointment_id, "is_deleted": False}
        invoices = await Invoice.find(self._build_tenant_query(filters)).sort("-created_at").limit(1).to_list()
        return invoices[0] if invoices else None

    async def get_invoice_payments(self, invoice_id: str) -> List[Payment]:
        filters = {"invoice_id": invoice_id, "is_deleted": False}
        return await Payment.find(self._build_tenant_query(filters)).sort("payment_date").to_list()

    async def list_paginated(
        self,
        salon_id: str,
        page: int = 1,
        limit: int = 20,
        search: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: str = "start_datetime",
        sort_order: str = "desc",
        date_from: Optional[datetime] = None,
        date_to: Optional[datetime] = None,
    ) -> Tuple[List[Appointment], int]:
        """
        Paginated appointment list for a salon with optional filtering, search, and sorting.
        Returns (items, total_count).
        """
        filters: Dict[str, Any] = {"salon_id": salon_id, "is_deleted": False}

        if status:
            filters["status"] = status.upper()

        if date_from:
            filters.setdefault("start_datetime", {})["$gte"] = date_from
        if date_to:
            filters.setdefault("start_datetime", {})["$lte"] = date_to

        merged = self._build_tenant_query(filters)

        total = await self.model.find(merged).count()

        allowed_sort = {"start_datetime", "created_at", "status", "total_price"}
        sort_field = sort_by if sort_by in allowed_sort else "start_datetime"
        sort_prefix = "-" if sort_order.lower() == "desc" else "+"
        sort_expr = f"{sort_prefix}{sort_field}"

        skip = (page - 1) * limit
        items = await self.model.find(merged).sort(sort_expr).skip(skip).limit(limit).to_list()

        return items, total
