export interface MasterServiceItem {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SalonServiceItem {
  id: string;
  salon_id: string;
  service_id?: string | null;
  custom_service_name?: string | null;
  service_name: string;
  price: number;
  status: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalonServicesQueryParams {
  salon_id?: string;
}

export interface CreateSalonServiceRequest {
  service_id?: string;
  custom_service_name?: string;
  price: number;
}

export interface UpdateSalonServiceRequest extends CreateSalonServiceRequest {
  status: string;
}
