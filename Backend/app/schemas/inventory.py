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
