from typing import Optional
from pydantic import Field
from app.models.base import BaseTenantDocument


class ProductInventory(BaseTenantDocument):
    """
    Salon-wise inventory snapshot for product + brand combinations.
    The transaction ledger remains the source of truth for stock movement.
    """

    salon_id: str = Field(..., index=True)
    product_id: str = Field(..., index=True)
    brand_id: Optional[str] = Field(default=None, index=True)
    product_name_snapshot: str = Field(..., max_length=150)
    brand_name_snapshot: Optional[str] = Field(default=None, max_length=100)
    category: str = Field(default="General", max_length=80, index=True)
    stock_quantity: int = Field(default=0, ge=0)
    min_threshold: int = Field(default=5, ge=0)
    buying_price: float = Field(default=0.0, ge=0.0)
    total_value: float = Field(default=0.0, ge=0.0)

    class Settings:
        name = "products_inventory"
        indexes = [
            [
                ("tenant_id", 1),
                ("salon_id", 1),
                ("product_id", 1),
                ("brand_id", 1),
                ("is_deleted", 1),
            ],
            [("tenant_id", 1), ("salon_id", 1), ("category", 1)],
            "is_deleted",
        ]

class InventoryItem(BaseTenantDocument):
    """
    Represents an inventory product in the salon (retail product or professional usage product).
    Tracks alert thresholds for automated restocking reminders.
    """
    name: str = Field(..., max_length=100)
    sku: str = Field(..., unique=True, index=True)  # Stock Keeping Unit
    description: Optional[str] = Field(default=None)
    
    # Financial metrics
    cost_price: float = Field(..., ge=0.0)  # Purchase cost
    retail_price: float = Field(..., ge=0.0)  # Sale price to client
    
    # Stock status caching (ledger remains final source of truth)
    quantity_in_stock: int = Field(default=0, ge=0)
    alert_threshold: int = Field(default=5, ge=0)  # Alerts generated when stock falls below this
    
    supplier_name: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True)

    class Settings:
        name = "inventory_items"
        indexes = [
            "tenant_id",
            "sku",
            "is_deleted",
        ]


class InventoryTransaction(BaseTenantDocument):
    """
    Leger-based Inventory transaction recording double-entry style stock modifications.
    Protects against race conditions and ensures perfect auditability of stock movements.
    """
    item_id: Optional[str] = Field(default=None, index=True)
    salon_id: str = Field(..., index=True)
    product_id: Optional[str] = Field(default=None, index=True)
    brand_id: Optional[str] = Field(default=None, index=True)
    
    # STOCK_IN (restock), APPOINTMENT_CONSUMPTION, RETAIL_SALE, WASTAGE, RECONCILIATION (adjustments)
    transaction_type: Optional[str] = Field(default=None, index=True)
    type: Optional[str] = Field(default=None, index=True)  # PURCHASE / USAGE / SALE / ADJUSTMENT
    
    # Amount added (+ve) or subtracted (-ve)
    quantity_change: Optional[int] = Field(default=None)
    quantity: Optional[int] = Field(default=None)
    
    # Price per unit for auditing cost of goods sold (COGS)
    unit_cost: float = Field(default=0.0, ge=0.0)
    price: Optional[float] = Field(default=None, ge=0.0)
    
    # Linked triggers e.g., Appointment ID or Invoice ID
    reference_id: Optional[str] = Field(default=None, index=True)
    notes: Optional[str] = Field(default=None)

    class Settings:
        name = "inventory_transactions"
        indexes = [
            # Highly performant compound index for audit and reconciliation histories
            [
                ("tenant_id", 1),
                ("item_id", 1),
                ("is_deleted", 1),
                ("created_at", -1),
            ],
            [
                ("tenant_id", 1),
                ("salon_id", 1),
                ("product_id", 1),
                ("brand_id", 1),
                ("created_at", -1),
            ],
            [
                ("tenant_id", 1),
                ("salon_id", 1),
                ("transaction_type", 1),
                ("created_at", -1),
            ],
            [
                ("tenant_id", 1),
                ("salon_id", 1),
                ("type", 1),
                ("created_at", -1),
            ],
        ]
