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
}

export interface BillListParams {
  salon_id: string;
  page?: number;
  limit?: number;
  payment_status?: string;
  search?: string;
}

export interface PaginatedBillData {
  items: BillListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
