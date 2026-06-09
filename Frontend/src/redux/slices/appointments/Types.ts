export interface AppointmentClient {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
}

export interface AppointmentServiceOption {
  salon_service_id: string;
  service_name: string;
  price: number;
  service_id?: string | null;
}

export interface AppointmentProductOption {
  salon_product_id: string;
  product_name: string;
  price: number;
  product_id?: string | null;
  brand_id?: string | null;
  brand_name?: string | null;
}

export interface AppointmentStaffOption {
  id: string;
  name: string;
  role: string;
}

export interface AppointmentServiceSnapshot {
  service_id: string;
  name: string;
  price: number;
  duration_minutes: number;
  tax_rate: number;
  staff_id?: string | null;
  staff_name?: string | null;
}

export interface AppointmentBillingPayment {
  id: string;
  amount: number;
  payment_method: string;
  status: string;
  transaction_reference?: string | null;
  refunded_amount: number;
  refund_reason?: string | null;
  payment_date: string;
}

export interface AppointmentBillingDetails {
  invoice_id?: string | null;
  invoice_number?: string | null;
  invoice_status?: string | null;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  amount_paid: number;
  payments: AppointmentBillingPayment[];
}

export interface AppointmentTimelineItem {
  status: string;
  changed_at: string;
  changed_by?: string | null;
  reason?: string | null;
}

export interface AppointmentListItem {
  id: string;
  salon_id: string;
  customer_id: string;
  customer_name: string;
  customer_phone: string;
  staff_id: string;
  staff_name?: string | null;
  start_datetime: string;
  end_datetime: string;
  total_price: number;
  status: string;
  notes?: string | null;
  booking_source: string;
  payment_type?: string | null;
  payment_status: string;
  paid_amount: number;
  services: AppointmentServiceSnapshot[];
  products: AppointmentProductSnapshot[];
  billing_details?: AppointmentBillingDetails;
  appointment_timeline?: AppointmentTimelineItem[];
}

export interface AppointmentProductSnapshot {
  product_id: string;
  name: string;
  price: number;
  tax_rate: number;
  staff_id?: string | null;
  staff_name?: string | null;
}

export interface AppointmentServiceRequest {
  service_id?: string;
  salon_service_id?: string;
  staff_id: string;
  price: number;
}

export interface AppointmentProductRequest {
  product_id?: string;
  salon_product_id?: string;
  staff_id: string;
  price: number;
}

export interface CreateFrontDeskAppointmentRequest {
  salon_id: string;
  customer_id: string;
  start_datetime: string;
  services: AppointmentServiceRequest[];
  products?: AppointmentProductRequest[];
  payment_type: string;
  payment_status: string;
  paid_amount?: number;
  total_amount: number;
  booking_source: string;
  notes?: string;
}

export interface CreateAppointmentClientRequest {
  name: string;
  phone: string;
  email?: string;
}

export interface SearchClientsParams {
  search: string;
}

export interface TodayAppointmentsParams {
  salon_id: string;
  status_filter?: string;
  include_completed?: boolean;
}

export interface BillByAppointmentParams {
  salon_id: string;
  appointment_id: string;
}

export interface AppointmentSalonServicesParams {
  salon_id: string;
}

export interface AppointmentSalonProductsParams {
  salon_id: string;
}

export interface AppointmentClientHistoryParams {
  id: string;
  salon_id?: string;
}

export interface AppointmentListParams {
  salon_id: string;
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sort_by?: string;
  sort_order?: string;
  date_from?: string;
  date_to?: string;
}

export interface PaginatedAppointmentData {
  items: AppointmentListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
