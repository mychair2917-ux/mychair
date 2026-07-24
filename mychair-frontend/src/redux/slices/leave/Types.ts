export const LEAVE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type LeaveStatus = (typeof LEAVE_STATUS)[keyof typeof LEAVE_STATUS];

export interface LeaveRequestItem {
  id: string;
  salon_id: string;
  employee_id: string;
  employee_name: string;
  employee_role: string;
  leave_date: string;
  leave_reason: string;
  status: LeaveStatus;
  approved_by?: string | null;
  approved_by_name?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedLeaveRequests {
  items: LeaveRequestItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface LeaveApplyRequest {
  leave_date: string;
  leave_reason: string;
}

export interface LeaveRejectRequest {
  rejection_reason?: string;
}

export interface LeaveListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: LeaveStatus;
  date_from?: string;
  date_to?: string;
  employee_id?: string;
  salon_id?: string;
  scope?: 'my' | 'team' | 'salon' | 'all';
  history_only?: boolean;
}
