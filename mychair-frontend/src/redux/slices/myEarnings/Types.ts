export interface MyEarningsQueryParams {
  month?: number;
  year?: number;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'custom';
  startDate?: string;
  endDate?: string;
  employeeId?: string;
}

export interface EarningsSummary {
  month: number;
  year: number;
  range_label: string;
  base_salary_to_date: number;
  today_earnings: number;
  today_incentives: number;
  service_incentive_today: number;
  product_incentive_today: number;
  month_earnings_to_date: number;
  month_incentives_to_date: number;
  pending_payout: number;
  estimated_month_end_earnings: number;
  wallet_balance: number;
  total_service_incentive: number;
  total_product_incentive: number;
  daily_average_earnings: number;
  completed_appointments_count: number;
  incentive_entries_count: number;
  month_progress_percent: number;
  target_progress_percent: number;
}

export interface DailyEarningsRow {
  date: string;
  service_earnings: number;
  product_earnings: number;
  service_incentive: number;
  product_incentive: number;
  total_earnings: number;
  total_incentives: number;
  appointment_references: string[];
}

export interface WalletTransaction {
  id: string;
  date: string;
  transaction_type: string;
  category: string;
  amount: number;
  running_balance: number;
  reference_id?: string | null;
  reference_label?: string | null;
  appointment_id?: string | null;
  item_name?: string | null;
  note?: string | null;
}

export interface WalletOverview {
  balance: number;
  earned_total: number;
  paid_out_total: number;
  transactions: WalletTransaction[];
}

export interface SalaryHistoryItem {
  id: string;
  month: number;
  year: number;
  salary_type: string;
  base_salary: number;
  service_incentive: number;
  product_incentive: number;
  bonus: number;
  deduction: number;
  total_earnings: number;
  paid_amount: number;
  pending_amount: number;
  final_paid_amount: number;
  payment_status: string;
  payment_date?: string | null;
  generated_at?: string | null;
}

export interface SalaryHistoryResponse {
  items: SalaryHistoryItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface BreakdownMetric {
  name: string;
  earnings: number;
  incentive: number;
  count: number;
}

export interface EarningsTrendPoint {
  label: string;
  earnings: number;
  incentives: number;
  service_incentive: number;
  product_incentive: number;
}

export interface BestEarningDay {
  date: string;
  total_earnings: number;
  total_incentives: number;
  service_earnings: number;
  product_earnings: number;
}

export interface EarningsActivityItem {
  id: string;
  date: string;
  item_type: 'SERVICE' | 'PRODUCT';
  item_name: string;
  reference_label?: string | null;
  appointment_id?: string | null;
  gross_amount: number;
  net_amount: number;
  incentive_amount: number;
  refund_amount: number;
  note?: string | null;
}

export interface IncentiveBreakdown {
  month: number;
  year: number;
  range_label: string;
  service_incentive_total: number;
  product_incentive_total: number;
  top_services: BreakdownMetric[];
  top_products: BreakdownMetric[];
  best_earning_days: BestEarningDay[];
  monthly_growth: EarningsTrendPoint[];
}
