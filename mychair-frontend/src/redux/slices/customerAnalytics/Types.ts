export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  email?: string;
  gender?: string;
  dob?: string;
  anniversary_date?: string;
  address?: string;
  notes?: string;
  is_member: boolean;
  membership_status?: 'ACTIVE' | 'EXPIRED' | 'NON_MEMBER';
  membership_start_date?: string | null;
  membership_end_date?: string | null;
  membership_type?: string | null;
  membership_created_by?: string | null;
  is_expiring_soon?: boolean;
  days_until_expiry?: number | null;
  reward_points: number;
  total_visits: number;
  total_spent: number;
  last_visit_at?: string;
  created_at: string;
  is_deleted: boolean;
}

export interface CustomerMembershipRecord {
  id: string;
  customer_id: string;
  membership_type: string;
  membership_start_date: string;
  membership_end_date: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | string;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at?: string | null;
}

export interface CustomerMembershipDetail {
  customer_id: string;
  customer_name?: string;
  is_member: boolean;
  membership_status: 'ACTIVE' | 'EXPIRED' | 'NON_MEMBER';
  membership_start_date?: string | null;
  membership_end_date?: string | null;
  membership_type?: string | null;
  membership_created_by?: string | null;
  is_expiring_soon?: boolean;
  days_until_expiry?: number | null;
  history: CustomerMembershipRecord[];
}

export interface AddMembershipPayload {
  customerId: string;
  duration_years?: number;
  membership_type?: string;
  start_date?: string;
}

export interface RenewMembershipPayload {
  customerId: string;
  duration_years?: number;
  membership_type?: string;
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
  membership_history?: CustomerMembershipRecord[];
}

export interface OverviewKPIs {
  total_customers: number;
  active_customers: number;
  new_customers: number;
  repeat_customers: number;
  total_members?: number;
  active_members?: number;
  expiring_soon_members?: number;
  expired_members?: number;
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
  membership?: string;
}

export interface CustomerCreatePayload {
  first_name: string;
  last_name?: string;
  phone: string;
  email?: string;
  gender?: string;
  dob?: string;
  anniversary_date?: string;
  address?: string;
  notes?: string;
  is_member?: boolean;
  membership_end_date?: string;
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

export interface CustomerImportErrorItem {
  row: number;
  mobile?: string | null;
  reason: string;
  status: 'skipped' | 'failed' | string;
  full_name?: string | null;
  original?: Record<string, string>;
}

export interface CustomerImportResult {
  totalRows: number;
  inserted: number;
  duplicates: number;
  skipped: number;
  failed: number;
  errors: CustomerImportErrorItem[];
  reasons: Record<string, number>;
  errorReportCsv?: string;
}

export interface PhoneAvailability {
  exists: boolean;
  clientName: string | null;
  valid: boolean;
  message: string | null;
}
