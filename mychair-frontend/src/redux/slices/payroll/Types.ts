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
  bonus: number;
  deduction: number;
  final_salary: number;
  final_paid_amount: number;
  payment_status: string;
  payment_date?: string | null;
  generated_at?: string | null;
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
  bonus: number;
  deduction: number;
  final_salary: number;
  final_paid_amount: number;
  payment_status: string;
  payment_date?: string | null;
  rows: PayrollBreakdownRow[];
}

export interface SalarySlip extends PayrollBreakdown {
  salon_id?: string;
  salon_name?: string | null;
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
