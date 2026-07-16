from typing import List, Literal, Optional

from pydantic import BaseModel, Field


DashboardRoleView = Literal["super_admin", "admin", "manager", "staff"]


class DashboardKpi(BaseModel):
    key: str
    label: str
    value: str
    sub: Optional[str] = None
    tone: str = "blue"


class DashboardQuickAction(BaseModel):
    key: str
    label: str
    module: str


class TrendPoint(BaseModel):
    label: str
    value: float


class DashboardAppointmentItem(BaseModel):
    id: str
    time: str
    client_name: str
    service_summary: str
    staff_name: str
    status: str


class PerformanceItem(BaseModel):
    id: str
    name: str
    subtitle: Optional[str] = None
    value: str


class DashboardAlert(BaseModel):
    key: str
    title: str
    message: str
    severity: Literal["info", "warning", "error"] = "warning"


class DashboardOperation(BaseModel):
    key: str
    label: str
    value: str
    sub: Optional[str] = None


class StaffPerformanceMetrics(BaseModel):
    monthly_services: int = 0
    customer_rating: Optional[float] = None
    target_progress_percent: float = 0.0


class AttendanceSnapshot(BaseModel):
    present_count: int = 0
    late_count: int = 0
    absent_count: int = 0
    leave_count: int = 0
    total_staff: int = 0


class StaffAttendanceStatus(BaseModel):
    status: Optional[str] = None
    is_checked_in: bool = False
    is_checked_out: bool = False
    total_hours: float = 0.0


class DashboardResponse(BaseModel):
    role_view: DashboardRoleView
    subtitle: str
    kpis: List[DashboardKpi] = Field(default_factory=list)
    quick_actions: List[DashboardQuickAction] = Field(default_factory=list)
    revenue_trend: List[TrendPoint] = Field(default_factory=list)
    appointment_trend: List[TrendPoint] = Field(default_factory=list)
    upcoming_appointments: List[DashboardAppointmentItem] = Field(default_factory=list)
    top_staff: List[PerformanceItem] = Field(default_factory=list)
    top_services: List[PerformanceItem] = Field(default_factory=list)
    top_salons: List[PerformanceItem] = Field(default_factory=list)
    operations: List[DashboardOperation] = Field(default_factory=list)
    alerts: List[DashboardAlert] = Field(default_factory=list)
    attendance_summary: Optional[AttendanceSnapshot] = None
    staff_attendance: Optional[StaffAttendanceStatus] = None
    performance: Optional[StaffPerformanceMetrics] = None
