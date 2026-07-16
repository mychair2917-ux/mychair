export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  email?: string;
  gender?: string;
  dob?: string;
  address?: string;
  notes?: string;
  reward_points: number;
  total_visits: number;
  total_spent: number;
  last_visit_at?: string;
  created_at: string;
  is_deleted: boolean;
}

export interface AppointmentHistoryItem {
  id: string;
  date: string;
  service: string;
  staff: string;
  amount: number;
}

export interface BillingHistoryItem {
  id: string;
  invoice_number: string;
  date: string;
  amount: number;
}

export interface RewardTransaction {
  id: string;
  date: string;
  points: number;
  type: string;
  bill_amount: number;
}

export interface CustomerDetail extends Customer {
  appointment_history: AppointmentHistoryItem[];
  billing_history: BillingHistoryItem[];
  reward_transactions: RewardTransaction[];
}

export interface OverviewKPIs {
  total_customers: number;
  active_customers: number;
  new_customers: number;
  repeat_customers: number;
  total_reward_points_issued: number;
  top_reward_customer: { id: string; name: string; points: number } | null;
  monthly_new_customers: Array<{ month: string; count: number }>;
  reward_points_trend: Array<{ month: string; points: number }>;
}

export interface RewardSettings {
  id: string;
  is_enabled: boolean;
  default_points: number;
  segments: RewardSegment[];
}

export interface RewardSegment {
  id: string;
  min_bill_amount: number;
  reward_points: number;
  created_at: string;
}

export interface PaginatedCustomers {
  items: Customer[];
  total: number;
  page: number;
  pages: number;
}

export interface CustomerListParams {
  page?: number;
  limit?: number;
  search?: string;
  gender?: string;
  status?: string;
}

export interface CustomerCreatePayload {
  first_name: string;
  last_name?: string;
  phone: string;
  email?: string;
  gender?: string;
  dob?: string;
  address?: string;
  notes?: string;
}

export interface CustomerUpdatePayload extends Partial<CustomerCreatePayload> {
  id: string;
}

export interface RewardSettingsUpdatePayload {
  is_enabled?: boolean;
  default_points?: number;
}

export interface SegmentCreatePayload {
  min_bill_amount: number;
  reward_points: number;
}

export interface SegmentUpdatePayload extends Partial<SegmentCreatePayload> {
  id: string;
}
