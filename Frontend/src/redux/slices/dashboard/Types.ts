export type DashboardRoleView = 'super_admin' | 'admin' | 'manager' | 'staff';

export interface DashboardKpi {
  key: string;
  label: string;
  value: string;
  sub?: string | null;
  tone: string;
}

export interface DashboardQuickAction {
  key: string;
  label: string;
  module: string;
}

export interface TrendPoint {
  label: string;
  value: number;
}

export interface DashboardAppointmentItem {
  id: string;
  time: string;
  client_name: string;
  service_summary: string;
  staff_name: string;
  status: string;
}

export interface PerformanceItem {
  id: string;
  name: string;
  subtitle?: string | null;
  value: string;
}

export interface DashboardAlert {
  key: string;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface DashboardOperation {
  key: string;
  label: string;
  value: string;
  sub?: string | null;
}

export interface StaffPerformanceMetrics {
  monthly_services: number;
  customer_rating?: number | null;
  target_progress_percent: number;
}

export interface AttendanceSnapshot {
  present_count: number;
  late_count: number;
  absent_count: number;
  leave_count?: number;
  total_staff: number;
}

export interface StaffAttendanceStatus {
  status?: string | null;
  is_checked_in: boolean;
  is_checked_out: boolean;
  total_hours: number;
}

export interface DashboardData {
  role_view: DashboardRoleView;
  subtitle: string;
  kpis: DashboardKpi[];
  quick_actions: DashboardQuickAction[];
  revenue_trend: TrendPoint[];
  appointment_trend: TrendPoint[];
  upcoming_appointments: DashboardAppointmentItem[];
  top_staff: PerformanceItem[];
  top_services: PerformanceItem[];
  top_salons: PerformanceItem[];
  operations: DashboardOperation[];
  alerts: DashboardAlert[];
  attendance_summary?: AttendanceSnapshot | null;
  staff_attendance?: StaffAttendanceStatus | null;
  performance?: StaffPerformanceMetrics | null;
}

export interface DashboardQueryParams {
  salonId?: string;
}
