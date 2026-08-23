export interface MyEarningsQueryParams {
  month?: number;
  year?: number;
  period?: 'daily' | 'weekly' | 'monthly' | 'custom';
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

export interface SalonEarningsQueryParams {
  month?: number;
  year?: number;
  period?: 'daily' | 'weekly' | 'monthly' | 'custom';
  startDate?: string;
  endDate?: string;
  staffId?: string;
  serviceId?: string;
  productId?: string;
  paymentMethod?: string;
  revenueType?: 'SERVICE' | 'PRODUCT' | '';
  page?: number;
  limit?: number;
}

export interface PeriodComparison {
  current_amount: number;
  previous_amount: number;
  change_percent: number | null;
  has_previous_data: boolean;
}

export interface SalonEarningsSummary {
  total_revenue: number;
  service_revenue: number;
  product_revenue: number;
  discounts: number;
  refunds: number;
  taxes: number;
  staff_incentives: number;
  total_product_cost?: number;
  product_staff_incentives?: number;
  total_product_profit?: number;
  net_salon_earnings: number;
  invoice_count: number;
  comparison: PeriodComparison;
}

export interface RevenueSource {
  key: string;
  label: string;
  amount: number;
  percent: number;
}

export interface SalonTrendPoint {
  label: string;
  date?: string | null;
  total_revenue: number;
  service_revenue: number;
  product_revenue: number;
  net_salon_earnings: number;
}

export interface ServiceEarningsRow {
  service_id: string;
  service_name: string;
  times_performed: number;
  gross_revenue: number;
  discounts: number;
  net_revenue: number;
  staff_names: string[];
  staff_incentive: number;
  salon_earnings: number;
}

export interface ProductEarningsRow {
  product_id: string;
  product_name: string;
  quantity_sold: number;
  unit_price?: number | null;
  gross_sales: number;
  discounts: number;
  refunds?: number;
  net_sales: number;
  sold_by: string[];
  buying_price?: number | null;
  product_cost: number | null;
  staff_incentive_pct?: number | null;
  staff_incentive: number;
  profit: number | null;
  salon_earnings: number;
}

export interface StaffPerformanceRow {
  staff_id: string;
  staff_name: string;
  services_performed: number;
  service_revenue: number;
  product_sales: number;
  total_generated_revenue: number;
  incentive: number;
  salon_contribution: number;
}

export interface SalonTransactionRow {
  id: string;
  invoice_number: string;
  date: string;
  client_name?: string | null;
  services_summary: string;
  products_summary: string;
  gross_amount: number;
  discount: number;
  tax: number;
  final_amount: number;
  payment_method?: string | null;
  payment_status: string;
  refund_amount: number;
  staff_summary: string;
}

export interface FilterOption {
  value: string;
  label: string;
}

export interface SalonEarningsFilterOptions {
  staff: FilterOption[];
  services: FilterOption[];
  products: FilterOption[];
  payment_methods: FilterOption[];
}

export interface SalonEarningsReport {
  month: number;
  year: number;
  range_label: string;
  period_start: string;
  period_end: string;
  summary: SalonEarningsSummary;
  revenue_sources: RevenueSource[];
  trend: SalonTrendPoint[];
  services: ServiceEarningsRow[];
  products: ProductEarningsRow[];
  staff_performance: StaffPerformanceRow[];
  filter_options: SalonEarningsFilterOptions;
}

export interface SalonTransactionsResponse {
  items: SalonTransactionRow[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  period_start: string;
  period_end: string;
  range_label: string;
}
