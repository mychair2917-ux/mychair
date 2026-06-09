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
  brand_id?: string | null;
  custom_product_name?: string | null;
  custom_brand_name?: string | null;
  product_name: string;
  base_product_name?: string | null;
  brand_name?: string | null;
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
  brand_id?: string;
  custom_product_name?: string;
  custom_brand_name?: string;
  price: number;
}

export interface UpdateSalonProductRequest extends CreateSalonProductRequest {
  status: string;
}

export interface BrandItem {
  id: string;
  name: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface BrandsQueryParams {
  salon_id?: string;
  search?: string;
}
