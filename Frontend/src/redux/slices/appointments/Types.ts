export interface AppointmentClient {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
}

export interface AppointmentServiceOption {
  id: string;
  name: string;
  category: string;
  price: number;
  duration_minutes: number;
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
  paid_amount: number;
  services: AppointmentServiceSnapshot[];
}

export interface AppointmentServiceRequest {
  service_id: string;
  staff_id: string;
  price: number;
}

export interface CreateFrontDeskAppointmentRequest {
  salon_id: string;
  customer_id: string;
  start_datetime: string;
  services: AppointmentServiceRequest[];
  payment_type: string;
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
