from typing import Any, Dict, List, Optional, Tuple

from app.models.expense import Expense
from app.repositories.base import BaseRepository


class ExpenseRepository(BaseRepository[Expense]):
    def __init__(self) -> None:
        super().__init__(Expense)

    async def list_expenses(
        self,
        filters: Dict[str, Any],
        page: int = 1,
        limit: int = 20,
        sort_by: str = "expense_date",
        sort_order: str = "desc",
        search: Optional[str] = None,
    ) -> Tuple[List[Expense], int]:
        query = self._build_tenant_query(filters)

        if search and search.strip():
            term = search.strip()
            amount_clause: Any = None
            try:
                amount_clause = float(term.replace(",", "").replace("₹", "").strip())
            except ValueError:
                amount_clause = None

            or_clauses: List[Dict[str, Any]] = [
                {"category": {"$regex": term, "$options": "i"}},
                {"vendor_name": {"$regex": term, "$options": "i"}},
                {"description": {"$regex": term, "$options": "i"}},
                {"payment_mode": {"$regex": term, "$options": "i"}},
                {"expense_no": {"$regex": term, "$options": "i"}},
            ]
            if amount_clause is not None:
                or_clauses.append({"amount": amount_clause})
            query["$or"] = or_clauses

        allowed_sort = {
            "expense_date",
            "amount",
            "category",
            "payment_mode",
            "vendor_name",
            "created_at",
            "expense_no",
        }
        sort_field = sort_by if sort_by in allowed_sort else "expense_date"
        prefix = "-" if sort_order.lower() == "desc" else "+"

        total = await Expense.find(query).count()
        skip = max(0, (page - 1) * limit)
        items = (
            await Expense.find(query)
            .sort(f"{prefix}{sort_field}")
            .skip(skip)
            .limit(limit)
            .to_list()
        )
        return items, total

    async def count_for_salon(self, salon_id: str) -> int:
        query = self._build_tenant_query({"salon_id": salon_id})
        return await Expense.find(query).count()
