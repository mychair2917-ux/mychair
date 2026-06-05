export interface SalonOwnerLoginRequest {
  email: string;
  password: string;
}

export interface SalonOwnerLoginResponseData {
  access_token: string;
  refresh_token: string;
  role: string;
  salon_id: string;
  id?: string;
  email: string;
  username: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  alternate_phone?: string;
  avatar?: string | null;
  employee_id?: string;
  employee_code?: string;
  branch_name?: string;
  branch_id?: string;
  salon_name?: string;
  department?: string;
  designation?: string;
  shift?: string;
  status?: string;
  joining_date?: string | null;
  last_login?: string | null;
}

export interface SalonOwnerProfileData {
  salon_name: string;
  slug: string;
  email: string;
  username: string;
  owner_full_name?: string;
  owner_phone_number?: string;
  salon_phone_number?: string;
  salon_type?: string;
  branch_name?: string;
  subscription_plan?: string;
  address: string;
}
