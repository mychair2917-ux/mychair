export interface SalaryStructureItem {
  employee_id: string;
  employee_name: string;
  role: string;
  salary: number;
  salary_type: string;
  incentive_base: boolean;
  service_incentive_percent: number;
  product_incentive_percent: number;
  joining_date?: string | null;
  is_active: boolean;
}

export interface SalaryStructureUpdateRequest {
  salary: number;
  salary_type: string;
  joining_date?: string | null;
  incentive_base: boolean;
  service_incentive_percent?: number | null;
  product_incentive_percent?: number | null;
}

export interface PayrollItem {
  id: string;
  employee_id: string;
  employee_name?: string | null;
  employee_role?: string | null;
  salary_type: string;
  month: number;
  year: number;
  base_salary: number;
  service_incentive: number;
  product_incentive: number;
  manager_incentive?: number;
  bonus: number;
  deduction: number;
  final_salary: number;
  final_paid_amount: number;
  payment_status: string;
  payment_date?: string | null;
  generated_at?: string | null;
  generated_by?: string | null;
  is_locked?: boolean;
  version?: number;
  calculation_log?: Record<string, unknown> | null;
}

export interface PayrollBreakdownRow {
  type: string;
  amount: number;
}

export interface PayrollBreakdown {
  id: string;
  employee_id: string;
  employee_name?: string | null;
  employee_role?: string | null;
  month: number;
  year: number;
  salary_type: string;
  base_salary: number;
  service_incentive_percent: number;
  product_incentive_percent: number;
  service_sales_total: number;
  product_sales_total: number;
  service_incentive: number;
  product_incentive: number;
  manager_incentive?: number;
  bonus: number;
  deduction: number;
  final_salary: number;
  final_paid_amount: number;
  payment_status: string;
  payment_date?: string | null;
  generated_at?: string | null;
  generated_by?: string | null;
  is_locked?: boolean;
  version?: number;
  calculation_log?: Record<string, unknown> | null;
  rows: PayrollBreakdownRow[];
}

export interface PayrollPreviewResponse {
  items: PayrollItem[];
  payroll_exists: boolean;
  has_paid_records: boolean;
  total_base_salary: number;
  total_service_incentive: number;
  total_product_incentive: number;
  total_manager_incentive: number;
  total_gross_salary: number;
  message: string;
}

export interface SalarySlip extends PayrollBreakdown {
  salon_id?: string;
  salon_name?: string | null;
  salon_phone?: string | null;
  salon_email?: string | null;
  salon_address?: string | null | Record<string, unknown>;
  salon_logo_url?: string | null;
  employee_phone?: string | null;
  employee_code?: string | null;
  generated_at?: string | null;
}

export interface PaginatedPayrollHistory {
  items: PayrollItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface MonthlyPayrollParams {
  month: number;
  year: number;
  force_regenerate?: boolean;
}

export interface PayrollHistoryParams {
  month?: number;
  year?: number;
  employee_id?: string;
  payment_status?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_order?: string;
}
