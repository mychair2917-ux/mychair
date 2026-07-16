from datetime import datetime
from typing import Optional

from pydantic import Field
from pymongo import ASCENDING, IndexModel

from app.models.base import BaseTenantDocument
from app.constants.payroll_options import (
    DEFAULT_SALARY_TYPE,
    PAYMENT_STATUS_PENDING,
)
from app.utils.timezone import now_utc


class Payroll(BaseTenantDocument):
    """
    Permanent monthly payroll snapshot for a single employee.

    Once generated, the salary breakdown (base salary, incentives, final salary)
    is frozen and must never be affected by later employee salary-config changes.
    Uniqueness of (tenant_id, employee_id, month, year) prevents duplicate
    generation for the same period.
    """

    salon_id: str = Field(..., index=True)
    employee_id: str = Field(..., index=True)

    # Snapshotted employee identity (kept for permanent historical display)
    employee_name: Optional[str] = Field(default=None)
    employee_role: Optional[str] = Field(default=None)
    salary_type: str = Field(default=DEFAULT_SALARY_TYPE)

    month: int = Field(..., ge=1, le=12, index=True)
    year: int = Field(..., ge=2000, le=3000, index=True)

    base_salary: float = Field(default=0.0, ge=0.0)

    # Snapshotted incentive configuration used for this period
    service_incentive_percent: float = Field(default=0.0, ge=0.0)
    product_incentive_percent: float = Field(default=0.0, ge=0.0)

    # Snapshotted sales the incentives were derived from
    service_sales_total: float = Field(default=0.0, ge=0.0)
    product_sales_total: float = Field(default=0.0, ge=0.0)

    service_incentive: float = Field(default=0.0, ge=0.0)
    product_incentive: float = Field(default=0.0, ge=0.0)
    bonus: float = Field(default=0.0, ge=0.0)
    deduction: float = Field(default=0.0, ge=0.0)
    final_salary: float = Field(default=0.0, ge=0.0)
    final_paid_amount: float = Field(default=0.0, ge=0.0)

    payment_status: str = Field(default=PAYMENT_STATUS_PENDING, index=True)
    payment_date: Optional[datetime] = Field(default=None)

    generated_at: datetime = Field(default_factory=now_utc)

    class Settings:
        name = "payrolls"
        indexes = [
            "tenant_id",
            "salon_id",
            "employee_id",
            "month",
            "year",
            "payment_status",
            "is_deleted",
            # Unique constraint: prevents duplicate payroll generation
            # for the same employee within the same month/year.
            IndexModel(
                [
                    ("tenant_id", ASCENDING),
                    ("employee_id", ASCENDING),
                    ("month", ASCENDING),
                    ("year", ASCENDING),
                ],
                name="uniq_employee_month_year",
                unique=True,
            ),
        ]
