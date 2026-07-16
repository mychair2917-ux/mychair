from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class EarningsActivityItem(BaseModel):
    id: str
    date: datetime
    item_type: str
    item_name: str
    reference_label: Optional[str] = None
    appointment_id: Optional[str] = None
    gross_amount: float = 0.0
    net_amount: float = 0.0
    incentive_amount: float = 0.0
    refund_amount: float = 0.0
    note: Optional[str] = None


class EarningsTrendPoint(BaseModel):
    label: str
    earnings: float = 0.0
    incentives: float = 0.0
    service_incentive: float = 0.0
    product_incentive: float = 0.0


class BestEarningDay(BaseModel):
    date: datetime
    total_earnings: float = 0.0
    total_incentives: float = 0.0
    service_earnings: float = 0.0
    product_earnings: float = 0.0


class EarningsSummary(BaseModel):
    month: int
    year: int
    range_label: str = "monthly"
    base_salary_to_date: float = 0.0
    today_earnings: float = 0.0
    today_incentives: float = 0.0
    service_incentive_today: float = 0.0
    product_incentive_today: float = 0.0
    month_earnings_to_date: float = 0.0
    month_incentives_to_date: float = 0.0
    pending_payout: float = 0.0
    estimated_month_end_earnings: float = 0.0
    wallet_balance: float = 0.0
    total_service_incentive: float = 0.0
    total_product_incentive: float = 0.0
    daily_average_earnings: float = 0.0
    completed_appointments_count: int = 0
    incentive_entries_count: int = 0
    month_progress_percent: float = 0.0
    target_progress_percent: float = 0.0


class DailyEarningsRow(BaseModel):
    date: datetime
    service_earnings: float = 0.0
    product_earnings: float = 0.0
    service_incentive: float = 0.0
    product_incentive: float = 0.0
    total_earnings: float = 0.0
    total_incentives: float = 0.0
    appointment_references: List[str] = Field(default_factory=list)


class WalletTransaction(BaseModel):
    id: str
    date: datetime
    transaction_type: str
    category: str
    amount: float
    running_balance: float
    reference_id: Optional[str] = None
    reference_label: Optional[str] = None
    appointment_id: Optional[str] = None
    item_name: Optional[str] = None
    note: Optional[str] = None


class WalletOverview(BaseModel):
    balance: float = 0.0
    earned_total: float = 0.0
    paid_out_total: float = 0.0
    transactions: List[WalletTransaction] = Field(default_factory=list)


class SalaryHistoryItem(BaseModel):
    id: str
    month: int
    year: int
    salary_type: str
    base_salary: float
    service_incentive: float
    product_incentive: float
    bonus: float = 0.0
    deduction: float = 0.0
    total_earnings: float
    paid_amount: float
    pending_amount: float
    final_paid_amount: float = 0.0
    payment_status: str
    payment_date: Optional[datetime] = None
    generated_at: Optional[datetime] = None


class SalaryHistoryResponse(BaseModel):
    items: List[SalaryHistoryItem] = Field(default_factory=list)
    total: int = 0
    page: int = 1
    limit: int = 20
    pages: int = 1


class BreakdownMetric(BaseModel):
    name: str
    earnings: float = 0.0
    incentive: float = 0.0
    count: int = 0


class IncentiveBreakdown(BaseModel):
    month: int
    year: int
    range_label: str = "monthly"
    service_incentive_total: float = 0.0
    product_incentive_total: float = 0.0
    top_services: List[BreakdownMetric] = Field(default_factory=list)
    top_products: List[BreakdownMetric] = Field(default_factory=list)
    best_earning_days: List[BestEarningDay] = Field(default_factory=list)
    monthly_growth: List[EarningsTrendPoint] = Field(default_factory=list)
