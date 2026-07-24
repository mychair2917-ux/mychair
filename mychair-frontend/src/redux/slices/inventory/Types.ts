export interface InventoryOverview {
  total_products: number;
  low_stock_alerts: number;
  critical_alerts: number;
  category_breakdown: Array<{ category: string; count: number }>;
  brand_distribution: Array<{ brand: string; count: number }>;
  usage_trend: Array<{ date: string; quantity: number }>;
  warnings: Array<{
    inventory_id: string;
    product_name: string;
    status: string;
    message: string;
  }>;
}

export interface InventoryStockItem {
  id: string;
  salon_id: string;
  product_id: string;
  brand_id?: string | null;
  product_name: string;
  brand_name?: string | null;
  display_name: string;
  category: string;
  stock_quantity: number;
  min_threshold: number;
  buying_price: number;
  total_value: number;
  status: 'OK' | 'LOW' | 'CRITICAL';
  last_updated: string;
}

export interface InventoryTransactionItem {
  id: string;
  salon_id: string;
  product_id?: string | null;
  brand_id?: string | null;
  type: string;
  quantity: number;
  reference_id?: string | null;
  price?: number | null;
  notes?: string | null;
  created_at: string;
}

export interface InventoryReports {
  total_purchase_cost: number;
  usage_cost_summary: number;
  profit_impact_estimation: number;
  category_consumption: Array<{ category: string; quantity: number }>;
  brand_spending: Array<{ brand: string; amount: number }>;
  transactions: InventoryTransactionItem[];
}

export interface InventoryQueryParams {
  salon_id: string;
  search?: string;
  category?: string;
  brand?: string;
  start_date?: string;
  end_date?: string;
}

export interface InventoryPurchaseRequest {
  product_id?: string;
  custom_product_name?: string;
  brand_id?: string;
  custom_brand_name?: string;
  buying_price: number;
  quantity: number;
  category: string;
  min_threshold: number;
  notes?: string;
}

export interface InventoryUseRequest {
  inventory_id?: string;
  product_id?: string;
  brand_id?: string;
  quantity: number;
  type: 'USAGE' | 'SALE';
  reference_id?: string;
  notes?: string;
}
