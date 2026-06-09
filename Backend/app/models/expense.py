from datetime import datetime
from typing import Optional

from pydantic import Field
from pymongo import ASCENDING, DESCENDING, IndexModel

from app.models.base import BaseTenantDocument


class Expense(BaseTenantDocument):
    """Salon operational expense record."""

    expense_no: str = Field(..., index=True)
    salon_id: str = Field(..., index=True)
    branch_id: Optional[str] = Field(default=None, index=True)

    category: str = Field(..., index=True)
    amount: float = Field(..., ge=0.0)
    payment_mode: str = Field(..., index=True)
    expense_date: datetime = Field(..., index=True)

    vendor_name: Optional[str] = Field(default=None)
    description: Optional[str] = Field(default=None)
    receipt_url: Optional[str] = Field(default=None)

    created_by_name: Optional[str] = Field(default=None)

    class Settings:
        name = "expenses"
        indexes = [
            "tenant_id",
            "salon_id",
            "branch_id",
            "category",
            "payment_mode",
            "expense_date",
            "is_deleted",
            IndexModel([("tenant_id", ASCENDING), ("expense_date", DESCENDING)]),
            IndexModel([("tenant_id", ASCENDING), ("created_at", DESCENDING)]),
        ]
