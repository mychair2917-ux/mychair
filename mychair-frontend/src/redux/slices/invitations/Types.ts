export interface FormOption {
  value: string;
  label: string;
}

export interface InvitationFormOptionsData {
  invitable_roles: FormOption[];
  salon_types: FormOption[];
  subscription_plans: FormOption[];
  tenants: FormOption[];
  branches: FormOption[];
  managers: FormOption[];
}

export interface CreateInviteRequest {
  role: string;
  full_name: string;
  email?: string;
  phone?: string;
  password?: string;
  confirm_password?: string;
  username?: string;
  tenant_id?: string;
  branch_id?: string;
  branch_name?: string;
  reporting_manager_id?: string;
  salon_name?: string;
  salon_type?: string;
  subscription_plan?: string;
  salon_phone_number?: string;
  address?: string;
  gst_number?: string;
  // Salary configuration (manager & staff)
  salary?: number;
  salary_type?: string;
  joining_date?: string;
  incentive_base?: boolean;
  service_incentive_percent?: number;
  product_incentive_percent?: number;
  latitude?: number;
  longitude?: number;
  attendance_radius?: number;
  shift_start?: string;
  weekly_off?: string[];
}

/** @deprecated Use CreateInviteRequest */
export interface CreateInvitationRequest {
  salon_name: string;
  owner_full_name: string;
  email: string;
  owner_phone_number?: string;
  salon_phone_number?: string;
  salon_type: string;
  branch_name?: string;
  address?: string;
  subscription_plan: string;
}

export interface CreateInvitationResponseData {
  id?: string;
  salon_id?: string;
  owner_id?: string;
  salon_name?: string;
  email: string;
  invitation_sent: boolean;
  role?: string;
  status?: string;
}

export interface InviteListItem {
  id: string;
  invited_email: string;
  full_name: string;
  role: string;
  status: string;
  salon_id?: string;
  salon_name?: string;
  branch_name?: string;
  subscription_plan?: string;
  expires_at: string;
  created_at: string;
  accepted_at?: string | null;
  resend_count: number;
  login_phone?: string | null;
  login_email?: string | null;
  provisioned?: boolean;
}

export interface PaginatedInviteListData {
  items: InviteListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface InviteListParams {
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
  sort_by?: string;
  sort_order?: string;
}

export interface ValidateInvitationResponseData {
  salon_name: string;
  email: string;
  username: string;
  full_name?: string;
  role?: string;
  expires_at: string;
  is_valid: boolean;
}

export interface CreatePasswordRequest {
  token: string;
  password: string;
  confirm_password: string;
}

export interface CreatePasswordResponseData {
  owner_id?: string;
  user_id?: string;
  email: string;
  role?: string;
}

export interface ResendInviteRequest {
  invite_id: string;
}

export interface CancelInviteRequest {
  invite_id: string;
}
