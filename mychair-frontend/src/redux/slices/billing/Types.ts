export interface BillItem {
  item_type: 'SERVICE' | 'PRODUCT';
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  discount: number;
  staff_id?: string | null;
  staff_name?: string | null;
}

export interface BillListItem {
  id: string;
  invoice_number: string;
  appointment_id?: string | null;
  salon_id: string;
  salon_name?: string | null;
  salon_phone?: string | null;
  salon_address?: string | null;
  customer_id: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  payment_method?: string | null;
  payment_status: 'PAID' | 'PENDING' | 'PARTIALLY_PAID';
  status: string;
  notes?: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  services_summary: string;
  products_summary: string;
  items_summary: string;
  staff_summary: string;
  items: BillItem[];
  created_at?: string | null;
  finalized_at?: string | null;
  whatsapp_status?: 'sent' | 'failed' | 'pending' | string;
}

export interface BillListParams {
  salon_id: string;
  branch_id?: string;
  page?: number;
  limit?: number;
  payment_status?: string;
  bill_status?: string;
  payment_method?: string;
  staff_id?: string;
  staff_name?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface PaginatedBillData {
  items: BillListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface BillTaxBreakdown {
  rate: string;
  amount: number;
}

export interface BillPaymentDetail {
  id: string;
  amount: number;
  method: string;
  status: string;
  transaction_reference?: string | null;
  note?: string | null;
  installment_number?: number | null;
  status_after?: string | null;
  paid_amount_after?: number | null;
  remaining_amount_after?: number | null;
  payment_date?: string | null;
}

export interface BillPaymentHistoryEntry {
  installment_number: number;
  amount: number;
  method?: string | null;
  status_before?: string | null;
  status_after?: string | null;
  paid_amount_after: number;
  remaining_amount_after: number;
  note: string;
  payment_date?: string | null;
}

export interface BillLineDetail {
  item_id: string;
  name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  staff_id?: string | null;
  staff_name?: string | null;
}

export interface BillEntityDetail {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null | Record<string, unknown>;
  gst_number?: string | null;
  logo_url?: string | null;
  notes?: string | null;
}

export interface BillDetail extends BillListItem {
  customer: BillEntityDetail;
  salon: BillEntityDetail;
  services: BillLineDetail[];
  products: BillLineDetail[];
  tax_breakdown: BillTaxBreakdown[];
  payments: BillPaymentDetail[];
  payment_history?: BillPaymentHistoryEntry[];
}

export interface BulkBillingRowRecord {
  file_type: 'SERVICE' | 'PRODUCT';
  excel_row: number;
  original_bill_reference: string;
  client_name?: string | null;
  client_phone?: string | null;
  item_name?: string | null;
  item_type: 'SERVICE' | 'PRODUCT';
  staff_identifier?: string | null;
  resolved_staff_id?: string | null;
  resolved_staff_name?: string | null;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  line_total: number;
  payment_status?: string | null;
  payment_method?: string | null;
  paid_amount?: number | null;
  bill_date?: string | null;
  bill_group?: string | null;
  client_id_status?: string | null;
  notes?: string | null;
  status: 'VALID' | 'FAILED' | 'DUPLICATE' | 'COMMITTED';
  error_category?: string | null;
  error_message?: string | null;
  action_required?: string | null;
}

export interface GeneratedClientIdRecord {
  excel_row: number;
  bill_group?: string | null;
  customer_name: string;
  mobile?: string | null;
  client_id: string;
  bill_number?: string | null;
  invoice_number?: string | null;
  customer_status: string;
}

export interface EditBulkRowPayload {
  client_name?: string;
  mobile_number?: string;
  item_name?: string;
  staff_identifier?: string;
  quantity?: number;
  unit_price?: number;
  discount?: number;
  payment_method?: string;
  payment_status?: string;
  paid_amount?: number;
  bill_date?: string;
  bill_group?: string;
  notes?: string;
}

export interface StaffAmbiguityOption {
  id: string;
  name: string;
}

export interface StaffAmbiguityItem {
  excel_name: string;
  options: StaffAmbiguityOption[];
}

export interface BulkBillingBatchSummary {
  id?: string;
  batch_id: string;
  salon_id?: string;
  status: 'PENDING' | 'VALIDATED' | 'IMPORTING' | 'COMPLETED' | 'PARTIAL' | 'FAILED';
  filenames: string[];
  import_type: 'SERVICE' | 'PRODUCT' | 'COMBINED';
  deduct_inventory: boolean;
  total_rows: number;
  total_bills: number;
  valid_bills: number;
  invalid_bills: number;
  duplicate_bills: number;
  successful_bills: number;
  failed_bills: number;
  total_valid_amount: number;
  total_committed_amount: number;
  client_ids_generated_count?: number;
  customers_created_count?: number;
  ambiguous_staff?: StaffAmbiguityItem[];
  row_records?: BulkBillingRowRecord[];
  generated_client_ids?: GeneratedClientIdRecord[];
  created_at?: string | null;
  imported_at?: string | null;
}

export interface PaginatedBulkBatches {
  items: BulkBillingBatchSummary[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

