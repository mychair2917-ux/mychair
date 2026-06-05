import { ApiResponse } from '../api/Types';

export interface ProfileData {
  id: string;
  tenant_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name: string;
  email: string;
  phone?: string | null;
  alternate_phone?: string | null;
  gender?: string | null;
  dob?: string | null;
  avatar?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  role: string;
  department?: string | null;
  designation?: string | null;
  shift?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
  salon_name?: string | null;
  shift?: string | null;
  joining_date?: string | null;
  employee_id?: string | null;
  employee_code?: string | null;
  last_login?: string | null;
  status: string;
  is_active: boolean;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
  can_edit_professional_info: boolean;
  can_change_password: boolean;
  can_manage_avatar: boolean;
}

export interface UpdateProfileRequest {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  alternate_phone?: string | null;
  gender?: string | null;
  dob?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  pincode?: string | null;
  department?: string | null;
  designation?: string | null;
  shift?: string | null;
  branch_id?: string | null;
  branch_name?: string | null;
  employee_code?: string | null;
  joining_date?: string | null;
  status?: string | null;
  is_active?: boolean;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface AvatarRemoveRequest {
  remove: boolean;
}

export type ProfileResponse = ApiResponse<ProfileData>;
