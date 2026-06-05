from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator

from app.constants.payroll_options import VALID_SALARY_TYPE_VALUES


class SalaryStructureItem(BaseModel):
    """Employee salary configuration row for the Salary Structure tab."""
    employee_id: str
    employee_name: str
    role: str
    salary: float
    salary_type: str
    incentive_base: bool
    service_incentive_percent: float
    product_incentive_percent: float
    joining_date: Optional[datetime] = None
    is_active: bool = True


class SalaryStructureUpdate(BaseModel):
    """Payload to update a single employee's salary configuration."""
    salary: float = Field(..., ge=0.0)
    salary_type: str = Field(...)
    joining_date: Optional[datetime] = None
    incentive_base: bool = Field(...)
    service_incentive_percent: Optional[float] = Field(default=None, ge=0.0)
    product_incentive_percent: Optional[float] = Field(default=None, ge=0.0)

    @field_validator("salary_type")
    @classmethod
    def validate_salary_type(cls, value: str) -> str:
        normalized = (value or "").strip().lower()
        if normalized not in VALID_SALARY_TYPE_VALUES:
            raise ValueError("Please select a valid salary type")
        return normalized


class GeneratePayrollRequest(BaseModel):
    """Trigger payroll generation for a given month/year."""
    month: int = Field(..., ge=1, le=12)
    year: int = Field(..., ge=2000, le=3000)


class PayrollItem(BaseModel):
    """A single payroll snapshot row."""
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    employee_role: Optional[str] = None
    salary_type: str
    month: int
    year: int
    base_salary: float
    service_incentive: float
    product_incentive: float
    bonus: float = 0.0
    deduction: float = 0.0
    final_salary: float
    final_paid_amount: float = 0.0
    payment_status: str
    payment_date: Optional[datetime] = None
    generated_at: Optional[datetime] = None


class PayrollBreakdownRow(BaseModel):
    type: str
    amount: float


class PayrollBreakdown(BaseModel):
    """Detailed breakdown for the View Breakdown modal."""
    id: str
    employee_id: str
    employee_name: Optional[str] = None
    employee_role: Optional[str] = None
    month: int
    year: int
    salary_type: str
    base_salary: float
    service_incentive_percent: float
    product_incentive_percent: float
    service_sales_total: float
    product_sales_total: float
    service_incentive: float
    product_incentive: float
    bonus: float = 0.0
    deduction: float = 0.0
    final_salary: float
    final_paid_amount: float = 0.0
    payment_status: str
    payment_date: Optional[datetime] = None
    rows: List[PayrollBreakdownRow] = Field(default_factory=list)


class PaginatedPayroll(BaseModel):
    items: List[PayrollItem]
    total: int
    page: int
    limit: int
    pages: int
