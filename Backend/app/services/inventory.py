from typing import Optional
from app.models.inventory import InventoryItem, InventoryTransaction
from app.repositories.inventory import InventoryItemRepository, InventoryTransactionRepository
from app.core.exceptions import ResourceNotFoundException, InsufficientStockException
from app.core import tenant_context

class InventoryService:
    def __init__(self) -> None:
        self.item_repo = InventoryItemRepository()
        self.tx_repo = InventoryTransactionRepository()

    async def _update_cached_stock(self, item_id: str, salon_id: str) -> int:
        """
        Re-calculates physical stock level from the transactions ledger
        and updates the cached value in the primary InventoryItem document.
        """
        actual_stock = await self.tx_repo.calculate_actual_stock(item_id, salon_id)
        item = await self.item_repo.get(item_id)
        item.quantity_in_stock = actual_stock
        await item.save()
        return actual_stock

    async def add_stock(
        self,
        salon_id: str,
        item_id: str,
        quantity: int,
        unit_cost: float,
        notes: Optional[str] = None
    ) -> InventoryItem:
        """Adds stock to a salon branch (restock flow) and logs transaction ledger."""
        item = await self.item_repo.get(item_id)
        
        # Log ledger entry
        tx_data = {
            "item_id": item_id,
            "salon_id": salon_id,
            "transaction_type": "STOCK_IN",
            "quantity_change": quantity,
            "unit_cost": unit_cost,
            "notes": notes or f"Restock shipment of {quantity} units"
        }
        await self.tx_repo.create(tx_data)
        
        # Refresh cache
        await self._update_cached_stock(item_id, salon_id)
        return await self.item_repo.get(item_id)

    async def consume_stock_for_appointment(
        self,
        salon_id: str,
        appointment_id: str,
        item_id: str,
        quantity: int,
        notes: Optional[str] = None
    ) -> InventoryItem:
        """Deducts inventory consumed dynamically during an appointment service."""
        item = await self.item_repo.get(item_id)
        
        # Enforce actual stock balance check
        actual_stock = await self.tx_repo.calculate_actual_stock(item_id, salon_id)
        if actual_stock < quantity:
            raise InsufficientStockException(
                f"Insufficient stock for product '{item.name}'. Available: {actual_stock}, requested: {quantity}"
            )
            
        # Log ledger entry
        tx_data = {
            "item_id": item_id,
            "salon_id": salon_id,
            "transaction_type": "APPOINTMENT_CONSUMPTION",
            "quantity_change": -quantity,
            "unit_cost": item.cost_price,
            "reference_id": appointment_id,
            "notes": notes or f"Consumed {quantity} units in Appointment ID {appointment_id}"
        }
        await self.tx_repo.create(tx_data)
        
        # Refresh cache
        await self._update_cached_stock(item_id, salon_id)
        return await self.item_repo.get(item_id)

    async def record_wastage(
        self,
        salon_id: str,
        item_id: str,
        quantity: int,
        notes: str
    ) -> InventoryItem:
        """Deducts inventory lost, expired, or damaged (wastage)."""
        item = await self.item_repo.get(item_id)
        
        actual_stock = await self.tx_repo.calculate_actual_stock(item_id, salon_id)
        if actual_stock < quantity:
            raise InsufficientStockException(f"Insufficient stock to write-off wastage of {quantity} units.")
            
        tx_data = {
            "item_id": item_id,
            "salon_id": salon_id,
            "transaction_type": "WASTAGE",
            "quantity_change": -quantity,
            "unit_cost": item.cost_price,
            "notes": notes
        }
        await self.tx_repo.create(tx_data)
        
        await self._update_cached_stock(item_id, salon_id)
        return await self.item_repo.get(item_id)

    async def reconcile_stock(
        self,
        salon_id: str,
        item_id: str,
        physical_count: int,
        notes: Optional[str] = None
    ) -> InventoryItem:
        """
        Stocktake reconciliation flow.
        Calculates discrepancies between manual physical count and ledger totals,
        adjusting the ledger with a reconciliation record to match reality.
        """
        item = await self.item_repo.get(item_id)
        actual_stock = await self.tx_repo.calculate_actual_stock(item_id, salon_id)
        
        discrepancy = physical_count - actual_stock
        
        if discrepancy != 0:
            tx_data = {
                "item_id": item_id,
                "salon_id": salon_id,
                "transaction_type": "RECONCILIATION",
                "quantity_change": discrepancy,
                "unit_cost": item.cost_price,
                "notes": notes or f"Stocktake adjustment (physical count = {physical_count})"
            }
            await self.tx_repo.create(tx_data)
            
        await self._update_cached_stock(item_id, salon_id)
        return await self.item_repo.get(item_id)
