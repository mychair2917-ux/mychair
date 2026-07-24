from datetime import datetime
from pydantic import Field
from app.models.base import BaseTenantDocument
from app.utils.timezone import now_utc

class DailyRevenueStats(BaseTenantDocument):
    """Pre-aggregated daily financial metrics to skip heavy billing aggregates on every dashboard load."""
    salon_id: str = Field(..., index=True)
    date: str = Field(..., index=True)  # Format: "YYYY-MM-DD"
    
    total_sales: float = Field(default=0.0)
    service_revenue: float = Field(default=0.0)
    product_revenue: float = Field(default=0.0)
    tax_collected: float = Field(default=0.0)
    discounts_given: float = Field(default=0.0)
    
    cash_collected: float = Field(default=0.0)
    card_collected: float = Field(default=0.0)
    upi_collected: float = Field(default=0.0)
    
    appointment_count: int = Field(default=0)

    class Settings:
        name = "daily_revenue_stats"
        indexes = [
            [("tenant_id", 1), ("salon_id", 1), ("date", 1)],
            "is_deleted",
        ]


class StaffPerformanceStats(BaseTenantDocument):
    """Pre-aggregated productivity and performance logs per stylist."""
    staff_id: str = Field(..., index=True)
    salon_id: str = Field(..., index=True)
    date: str = Field(..., index=True)  # Format: "YYYY-MM-DD"
    
    total_revenue_generated: float = Field(default=0.0)
    commission_earned: float = Field(default=0.0)
    appointments_completed: int = Field(default=0)
    cancellation_count: int = Field(default=0)
    
    total_working_minutes: float = Field(default=0.0)
    utilization_rate: float = Field(default=0.0)  # (Booked Minutes / Available Working Minutes) * 100

    class Settings:
        name = "staff_performance_stats"
        indexes = [
            [("tenant_id", 1), ("staff_id", 1), ("date", 1)],
            "is_deleted",
        ]


class ServicePopularityStats(BaseTenantDocument):
    """Tracks popularity metric snapshots of services to drive inventory recommendations and advertising."""
    service_id: str = Field(..., index=True)
    salon_id: str = Field(..., index=True)
    date: str = Field(..., index=True)  # Format: "YYYY-MM-DD"
    
    booking_count: int = Field(default=0)
    revenue_generated: float = Field(default=0.0)

    class Settings:
        name = "service_popularity_stats"
        indexes = [
            [("tenant_id", 1), ("service_id", 1), ("date", 1)],
            "is_deleted",
        ]
