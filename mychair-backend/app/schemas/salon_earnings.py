from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class PeriodComparison(BaseModel):
    current_amount: float = 0.0
    previous_amount: float = 0.0
    change_percent: Optional[float] = None
    has_previous_data: bool = False


class SalonEarningsSummary(BaseModel):
    total_revenue: float = 0.0
    service_revenue: float = 0.0
    product_revenue: float = 0.0
    discounts: float = 0.0
    refunds: float = 0.0
    taxes: float = 0.0
    staff_incentives: float = 0.0
    net_salon_earnings: float = 0.0
    invoice_count: int = 0
    comparison: PeriodComparison = Field(default_factory=PeriodComparison)


class RevenueSource(BaseModel):
    key: str
    label: str
    amount: float = 0.0
    percent: float = 0.0


class EarningsTrendPoint(BaseModel):
    label: str
    date: Optional[datetime] = None
    total_revenue: float = 0.0
    service_revenue: float = 0.0
    product_revenue: float = 0.0
    net_salon_earnings: float = 0.0


class ServiceEarningsRow(BaseModel):
    service_id: str
    service_name: str
    times_performed: int = 0
    gross_revenue: float = 0.0
    discounts: float = 0.0
    net_revenue: float = 0.0
    staff_names: List[str] = Field(default_factory=list)
    staff_incentive: float = 0.0
    salon_earnings: float = 0.0


class ProductEarningsRow(BaseModel):
    product_id: str
    product_name: str
    quantity_sold: int = 0
    gross_sales: float = 0.0
    discounts: float = 0.0
    net_sales: float = 0.0
    sold_by: List[str] = Field(default_factory=list)
    product_cost: Optional[float] = None
    profit: Optional[float] = None
    staff_incentive: float = 0.0
    salon_earnings: float = 0.0


class StaffPerformanceRow(BaseModel):
    staff_id: str
    staff_name: str
    services_performed: int = 0
    service_revenue: float = 0.0
    product_sales: float = 0.0
    total_generated_revenue: float = 0.0
    incentive: float = 0.0
    salon_contribution: float = 0.0


class SalonTransactionRow(BaseModel):
    id: str
    invoice_number: str
    date: datetime
    client_name: Optional[str] = None
    services_summary: str = ""
    products_summary: str = ""
    gross_amount: float = 0.0
    discount: float = 0.0
    tax: float = 0.0
    final_amount: float = 0.0
    payment_method: Optional[str] = None
    payment_status: str = "PENDING"
    refund_amount: float = 0.0
    staff_summary: str = ""


class FilterOption(BaseModel):
    value: str
    label: str


class SalonEarningsFilterOptions(BaseModel):
    staff: List[FilterOption] = Field(default_factory=list)
    services: List[FilterOption] = Field(default_factory=list)
    products: List[FilterOption] = Field(default_factory=list)
    payment_methods: List[FilterOption] = Field(default_factory=list)


class SalonEarningsReport(BaseModel):
    month: int
    year: int
    range_label: str = "monthly"
    period_start: datetime
    period_end: datetime
    summary: SalonEarningsSummary
    revenue_sources: List[RevenueSource] = Field(default_factory=list)
    trend: List[EarningsTrendPoint] = Field(default_factory=list)
    services: List[ServiceEarningsRow] = Field(default_factory=list)
    products: List[ProductEarningsRow] = Field(default_factory=list)
    staff_performance: List[StaffPerformanceRow] = Field(default_factory=list)
    filter_options: SalonEarningsFilterOptions = Field(default_factory=SalonEarningsFilterOptions)


class SalonTransactionsResponse(BaseModel):
    items: List[SalonTransactionRow] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    limit: int = 20
    pages: int = 1
    period_start: datetime
    period_end: datetime
    range_label: str = "monthly"
