export interface EmployeeListItem {
  id: string;
  full_name: string;
  role: string;
  email: string;
  phone?: string | null;
  branch_name?: string | null;
  status: string;
  is_active: boolean;
  created_at: string;
  weekly_off?: string[];
}

export interface EmployeeUpdateRequest {
  first_name?: string;
  last_name?: string;
  phone?: string;
  role?: string;
  branch_name?: string;
  is_active?: boolean;
  weekly_off?: string[];
}

export interface EmployeeStatusRequest {
  is_active: boolean;
}

export interface EmployeeResetPasswordRequest {
  password: string;
  confirm_password: string;
}

export interface ListEmployeesParams {
  tenant_id?: string;
  role?: string;
  search?: string;
  status?: string;
}
