export interface LookupOption {
  value: string;
  label: string;
}

export interface ExpenseItem {
  id: string;
  expense_no: string;
  salon_id: string;
  branch_id?: string | null;
  category: string;
  category_label: string;
  amount: number;
  payment_mode: string;
  payment_mode_label: string;
  expense_date: string;
  vendor_name?: string | null;
  description?: string | null;
  receipt_url?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseListParams {
  salon_id: string;
  page?: number;
  limit?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  category?: string;
  payment_mode?: string;
  branch_id?: string;
}

export interface PaginatedExpenseData {
  items: ExpenseItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface CreateExpenseRequest {
  salon_id: string;
  branch_id?: string | null;
  category: string;
  amount: number;
  payment_mode: string;
  expense_date: string;
  vendor_name?: string | null;
  description?: string | null;
}

export interface UpdateExpenseRequest {
  branch_id?: string | null;
  category?: string;
  amount?: number;
  payment_mode?: string;
  expense_date?: string;
  vendor_name?: string | null;
  description?: string | null;
}
