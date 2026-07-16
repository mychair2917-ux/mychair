from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field

class InventoryItemCreate(BaseModel):
    name: str = Field(..., max_length=100)
    sku: str = Field(..., description="Unique product stock code")
    description: Optional[str] = None
    
    cost_price: float = Field(..., ge=0.0)
    retail_price: float = Field(..., ge=0.0)
    alert_threshold: int = Field(default=5, ge=0)
    
    supplier_name: Optional[str] = None


class StockInRequest(BaseModel):
    quantity: int = Field(..., gt=0, description="Number of units added")
    unit_cost: float = Field(..., ge=0.0, description="Actual purchase cost per unit")
    notes: Optional[str] = None


class StockReconciliationRequest(BaseModel):
    physical_count: int = Field(..., ge=0, description="Manual physical count observed")
    notes: Optional[str] = None


class InventoryPurchaseRequest(BaseModel):
    product_id: Optional[str] = None
    custom_product_name: Optional[str] = Field(default=None, max_length=150)
    brand_id: Optional[str] = None
    custom_brand_name: Optional[str] = Field(default=None, max_length=100)
    buying_price: float = Field(..., ge=0)
    quantity: int = Field(..., gt=0)
    category: str = Field(default="General", max_length=80)
    min_threshold: int = Field(default=5, ge=0)
    notes: Optional[str] = Field(default=None, max_length=500)


class InventoryUseRequest(BaseModel):
    inventory_id: Optional[str] = None
    product_id: Optional[str] = None
    brand_id: Optional[str] = None
    quantity: int = Field(..., gt=0)
    type: str = Field(default="USAGE", description="USAGE or SALE")
    reference_id: Optional[str] = None
    notes: Optional[str] = Field(default=None, max_length=500)


class InventoryStockItem(BaseModel):
    id: str
    salon_id: str
    product_id: str
    brand_id: Optional[str] = None
    product_name: str
    brand_name: Optional[str] = None
    display_name: str
    category: str
    stock_quantity: int
    min_threshold: int
    buying_price: float
    total_value: float
    status: str
    last_updated: datetime


class InventoryTransactionItem(BaseModel):
    id: str
    salon_id: str
    product_id: Optional[str] = None
    brand_id: Optional[str] = None
    type: str
    quantity: int
    reference_id: Optional[str] = None
    price: Optional[float] = None
    notes: Optional[str] = None
    created_at: datetime


class InventoryOverview(BaseModel):
    total_products: int
    low_stock_alerts: int
    critical_alerts: int
    category_breakdown: list[dict]
    brand_distribution: list[dict]
    usage_trend: list[dict]
    warnings: list[dict]


class InventoryReports(BaseModel):
    total_purchase_cost: float
    usage_cost_summary: float
    profit_impact_estimation: float
    category_consumption: list[dict]
    brand_spending: list[dict]
    transactions: list[InventoryTransactionItem]
