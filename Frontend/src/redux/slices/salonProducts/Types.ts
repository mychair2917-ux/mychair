export interface MasterProductItem {
  id: string;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface SalonProductItem {
  id: string;
  salon_id: string;
  product_id?: string | null;
  custom_product_name?: string | null;
  product_name: string;
  price: number;
  status: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalonProductsQueryParams {
  salon_id?: string;
}

export interface CreateSalonProductRequest {
  product_id?: string;
  custom_product_name?: string;
  price: number;
}

export interface UpdateSalonProductRequest extends CreateSalonProductRequest {
  status: string;
}
