from typing import Optional, List, Dict, Any
from app.models.inventory import InventoryItem, InventoryTransaction
from app.repositories.base import BaseRepository
from app.core import tenant_context

class InventoryItemRepository(BaseRepository[InventoryItem]):
    def __init__(self) -> None:
        super().__init__(InventoryItem)

    async def get_by_sku(self, sku: str) -> Optional[InventoryItem]:
        """Fetches an item by unique SKU."""
        filters = {"sku": sku}
        results = await self.list(filters=filters, limit=1)
        return results[0] if results else None

    async def get_low_stock_items(self, salon_id: str) -> List[InventoryItem]:
        """Fetches items where stock levels are below warning thresholds."""
        active_tenant = tenant_context.get_tenant_id()
        # Find items where quantity_in_stock <= alert_threshold
        filters = {
            "tenant_id": active_tenant,
            "is_deleted": False,
            "$expr": {"$lte": ["$quantity_in_stock", "$alert_threshold"]}
        }
        return await self.model.find(filters).to_list()


class InventoryTransactionRepository(BaseRepository[InventoryTransaction]):
    def __init__(self) -> None:
        super().__init__(InventoryTransaction)

    async def calculate_actual_stock(self, item_id: str, salon_id: str) -> int:
        """
        Double-entry audit query.
        Aggregates all transactional changes on this item to calculate actual stock.
        """
        active_tenant = tenant_context.get_tenant_id()
        pipeline = [
            {
                "$match": {
                    "tenant_id": active_tenant,
                    "item_id": item_id,
                    "salon_id": salon_id,
                    "is_deleted": False,
                }
            },
            {
                "$group": {
                    "_id": "$item_id",
                    "actual_stock": {"$sum": "$quantity_change"}
                }
            }
        ]
        
        # In Beanie, aggregation on collection uses self.model.get_motor_collection().aggregate()
        collection = self.model.get_motor_collection()
        cursor = collection.aggregate(pipeline)
        results = await cursor.to_list(length=1)
        
        if results:
            return results[0].get("actual_stock", 0)
        return 0
