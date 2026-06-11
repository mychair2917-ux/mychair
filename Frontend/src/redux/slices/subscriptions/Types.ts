export interface SubscriptionPlan {
  value: string;
  label: string;
}

export interface BillingHistoryItem {
  date: string;
  action: string;
  plan_name: string;
  plan_label: string;
  amount: number;
  notes: string;
}

export interface SubscriptionRecord {
  id: string;
  tenant_id: string;
  salon_id: string;
  salon_name: string;
  owner_email: string;
  plan_name: string;
  plan_label: string;
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED';
  amount: number;
  currency: string;
  start_date: string;
  end_date: string;
  total_days: number;
  days_remaining: number;
  created_at: string;
  updated_at: string;
}

export interface OwnerSubscriptionView extends SubscriptionRecord {
  available_plans: SubscriptionPlan[];
  billing_history: BillingHistoryItem[];
  is_expired: boolean;
}

export interface SubscriptionDashboardStats {
  total_active: number;
  total_expired: number;
  total_suspended: number;
  upcoming_expirations: number;
  default_subscription_days: number;
}

export interface SubscriptionStatus {
  status: string;
  plan_name?: string;
  plan_label?: string;
  end_date?: string;
  days_remaining: number;
  is_valid: boolean;
  show_reminder_banner: boolean;
  reminder_message: string | null;
}

export interface UpdateSubscriptionPayload {
  plan_name?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  extend_days?: number;
}
