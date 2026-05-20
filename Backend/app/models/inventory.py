from typing import Optional
from pydantic import Field
from app.models.base import BaseTenantDocument

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
    item_id: str = Field(..., index=True)
    salon_id: str = Field(..., index=True)
    
    # STOCK_IN (restock), APPOINTMENT_CONSUMPTION, RETAIL_SALE, WASTAGE, RECONCILIATION (adjustments)
    transaction_type: str = Field(..., index=True)
    
    # Amount added (+ve) or subtracted (-ve)
    quantity_change: int = Field(...)
    
    # Price per unit for auditing cost of goods sold (COGS)
    unit_cost: float = Field(default=0.0, ge=0.0)
    
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
                ("transaction_type", 1),
                ("created_at", -1),
            ],
        ]
