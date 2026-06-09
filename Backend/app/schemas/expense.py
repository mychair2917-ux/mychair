from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from app.constants.expense_options import (
    VALID_CATEGORY_VALUES,
    VALID_PAYMENT_MODE_VALUES,
)


class ExpenseCreateRequest(BaseModel):
    salon_id: str = Field(..., min_length=1)
    branch_id: Optional[str] = None
    category: str = Field(..., min_length=1)
    amount: float = Field(..., gt=0)
    payment_mode: str = Field(..., min_length=1)
    expense_date: datetime
    vendor_name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("category", "payment_mode", mode="before")
    @classmethod
    def normalize_lookup(cls, value: str) -> str:
        return str(value).strip().lower().replace(" ", "_")

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: str) -> str:
        if value not in VALID_CATEGORY_VALUES:
            raise ValueError("Invalid expense category")
        return value

    @field_validator("payment_mode")
    @classmethod
    def validate_payment_mode(cls, value: str) -> str:
        if value not in VALID_PAYMENT_MODE_VALUES:
            raise ValueError("Invalid payment mode")
        return value

    @field_validator("vendor_name", "description", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = str(value).strip()
        return stripped or None


class ExpenseUpdateRequest(BaseModel):
    branch_id: Optional[str] = None
    category: Optional[str] = None
    amount: Optional[float] = Field(default=None, gt=0)
    payment_mode: Optional[str] = None
    expense_date: Optional[datetime] = None
    vendor_name: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)

    @field_validator("category", "payment_mode", mode="before")
    @classmethod
    def normalize_lookup(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        return str(value).strip().lower().replace(" ", "_")

    @field_validator("category")
    @classmethod
    def validate_category(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        if value not in VALID_CATEGORY_VALUES:
            raise ValueError("Invalid expense category")
        return value

    @field_validator("payment_mode")
    @classmethod
    def validate_payment_mode(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        if value not in VALID_PAYMENT_MODE_VALUES:
            raise ValueError("Invalid payment mode")
        return value

    @field_validator("vendor_name", "description", mode="before")
    @classmethod
    def strip_optional_strings(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return None
        stripped = str(value).strip()
        return stripped or None


class ExpenseItem(BaseModel):
    id: str
    expense_no: str
    salon_id: str
    branch_id: Optional[str] = None
    category: str
    category_label: str
    amount: float
    payment_mode: str
    payment_mode_label: str
    expense_date: datetime
    vendor_name: Optional[str] = None
    description: Optional[str] = None
    receipt_url: Optional[str] = None
    created_by: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class PaginatedExpenseData(BaseModel):
    items: List[ExpenseItem]
    total: int
    page: int
    limit: int
    pages: int
