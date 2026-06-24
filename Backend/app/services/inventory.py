from datetime import datetime, time, timedelta, timezone
from typing import Any, Optional

from beanie import PydanticObjectId

from app.models.inventory import InventoryItem, InventoryTransaction, ProductInventory
from app.models.salon_product import SalonProduct
from app.repositories.inventory import InventoryItemRepository, InventoryTransactionRepository
from app.core.exceptions import ResourceNotFoundException, InsufficientStockException
from app.core import tenant_context
from app.models.user import User
from app.schemas.inventory import (
    InventoryOverview,
    InventoryReports,
    InventoryStockItem,
    InventoryTransactionItem,
)
from app.schemas.salon_product import SalonProductCreate
from app.services.brand import BrandService
from app.services.notifications import notification_service
from app.services.salon_product import SalonProductService

class InventoryService:
    def __init__(self) -> None:
        self.item_repo = InventoryItemRepository()
        self.tx_repo = InventoryTransactionRepository()
        self.brand_service = BrandService()
        self.salon_product_service = SalonProductService()

    @staticmethod
    def _display_name(product_name: str, brand_name: str | None) -> str:
        return f"{product_name} ({brand_name})" if brand_name else product_name

    @staticmethod
    def _stock_status(stock: int, threshold: int) -> str:
        if stock <= 0:
            return "CRITICAL"
        if threshold > 0 and stock <= max(1, int(threshold * 0.2)):
            return "CRITICAL"
        if stock <= threshold:
            return "LOW"
        return "OK"

    def _inventory_to_item(self, item: ProductInventory) -> InventoryStockItem:
        return InventoryStockItem(
            id=str(item.id),
            salon_id=item.salon_id,
            product_id=item.product_id,
            brand_id=item.brand_id,
            product_name=item.product_name_snapshot,
            brand_name=item.brand_name_snapshot,
            display_name=self._display_name(
                item.product_name_snapshot,
                item.brand_name_snapshot,
            ),
            category=item.category,
            stock_quantity=item.stock_quantity,
            min_threshold=item.min_threshold,
            buying_price=item.buying_price,
            total_value=item.total_value,
            status=self._stock_status(item.stock_quantity, item.min_threshold),
            last_updated=item.updated_at,
        )

    def _transaction_to_item(self, tx: InventoryTransaction) -> InventoryTransactionItem:
        tx_type = tx.type or tx.transaction_type or "ADJUSTMENT"
        quantity = tx.quantity
        if quantity is None:
            quantity = abs(tx.quantity_change or 0)
        return InventoryTransactionItem(
            id=str(tx.id),
            salon_id=tx.salon_id,
            product_id=tx.product_id,
            brand_id=tx.brand_id,
            type=tx_type,
            quantity=quantity,
            reference_id=tx.reference_id,
            price=tx.price if tx.price is not None else tx.unit_cost,
            notes=tx.notes,
            created_at=tx.created_at,
        )

    async def _resolve_product_for_inventory(
        self,
        actor: User,
        salon_id: str,
        product_id: str | None,
        custom_product_name: str | None,
        price: float,
    ) -> tuple[str, str]:
        payload = SalonProductCreate(
            product_id=product_id,
            custom_product_name=custom_product_name,
            price=price,
        )
        return await self.salon_product_service._get_or_create_product(actor, payload, salon_id)

    async def _sync_product_inventory(self, inventory: ProductInventory) -> ProductInventory:
        stock = await self.calculate_product_stock(
            inventory.salon_id,
            inventory.product_id,
            inventory.brand_id,
        )
        inventory.stock_quantity = max(0, stock)
        inventory.total_value = round(inventory.stock_quantity * inventory.buying_price, 2)
        await inventory.save()
        await self._create_stock_alert_if_needed(inventory)
        return inventory

    async def _create_stock_alert_if_needed(self, inventory: ProductInventory) -> None:
        status = self._stock_status(inventory.stock_quantity, inventory.min_threshold)
        if status not in {"LOW", "CRITICAL"}:
            return
        display_name = self._display_name(
            inventory.product_name_snapshot,
            inventory.brand_name_snapshot,
        )
        alert_type = "OUT_OF_STOCK" if inventory.stock_quantity <= 0 else "LOW_STOCK"
        await notification_service.create_business_alert(
            tenant_id=inventory.tenant_id or tenant_context.get_tenant_id(),
            salon_id=inventory.salon_id,
            alert_type=alert_type,
            category="INVENTORY",
            title="Out of stock" if alert_type == "OUT_OF_STOCK" else "Low stock",
            message=f"{display_name} has {inventory.stock_quantity} unit(s) remaining.",
            priority="HIGH" if alert_type == "OUT_OF_STOCK" else "NORMAL",
            source_id=str(inventory.id),
            metadata={
                "product_id": inventory.product_id,
                "brand_id": inventory.brand_id,
                "stock_quantity": inventory.stock_quantity,
                "min_threshold": inventory.min_threshold,
            },
        )

    async def calculate_product_stock(
        self,
        salon_id: str,
        product_id: str,
        brand_id: str | None = None,
    ) -> int:
        query: dict[str, Any] = {
            "salon_id": salon_id,
            "product_id": product_id,
            "brand_id": brand_id,
            "is_deleted": False,
        }
        active_tenant = tenant_context.get_tenant_id()
        if active_tenant:
            query["tenant_id"] = active_tenant
        transactions = await InventoryTransaction.find(query).to_list()
        total = 0
        for tx in transactions:
            if tx.quantity_change is not None:
                total += tx.quantity_change
                continue
            quantity = tx.quantity or 0
            if (tx.type or "").upper() in {"PURCHASE", "ADJUSTMENT"}:
                total += quantity
            elif (tx.type or "").upper() in {"USAGE", "SALE"}:
                total -= quantity
        return total

    async def list_stocks(
        self,
        salon_id: str,
        search: str | None = None,
        category: str | None = None,
        brand: str | None = None,
    ) -> list[InventoryStockItem]:
        query: dict[str, Any] = {"salon_id": salon_id, "is_deleted": False}
        active_tenant = tenant_context.get_tenant_id()
        if active_tenant:
            query["tenant_id"] = active_tenant
        if category:
            query["category"] = {"$regex": category.strip(), "$options": "i"}
        if brand:
            query["brand_name_snapshot"] = {"$regex": brand.strip(), "$options": "i"}
        if search:
            term = search.strip()
            query["$or"] = [
                {"product_name_snapshot": {"$regex": term, "$options": "i"}},
                {"brand_name_snapshot": {"$regex": term, "$options": "i"}},
                {"category": {"$regex": term, "$options": "i"}},
            ]
        items = await ProductInventory.find(query).sort("-updated_at").to_list()
        return [self._inventory_to_item(item) for item in items]

    async def record_purchase(
        self,
        actor: User,
        salon_id: str,
        product_id: str | None,
        custom_product_name: str | None,
        brand_id: str | None,
        custom_brand_name: str | None,
        buying_price: float,
        quantity: int,
        category: str,
        min_threshold: int,
        notes: str | None = None,
    ) -> InventoryStockItem:
        resolved_product_id, product_name = await self._resolve_product_for_inventory(
            actor,
            salon_id,
            product_id,
            custom_product_name,
            buying_price,
        )
        resolved_brand_id, brand_name = await self.brand_service.resolve_brand(
            actor,
            brand_id,
            custom_brand_name,
            salon_id,
        )

        query = {
            "salon_id": salon_id,
            "product_id": resolved_product_id,
            "brand_id": resolved_brand_id,
            "is_deleted": False,
        }
        active_tenant = tenant_context.get_tenant_id()
        if active_tenant:
            query["tenant_id"] = active_tenant
        inventory = await ProductInventory.find_one(query)
        if not inventory:
            inventory = ProductInventory(
                salon_id=salon_id,
                product_id=resolved_product_id,
                brand_id=resolved_brand_id,
                product_name_snapshot=product_name,
                brand_name_snapshot=brand_name,
                category=(category or "General").strip() or "General",
                stock_quantity=0,
                min_threshold=min_threshold,
                buying_price=buying_price,
                total_value=0,
                created_by=str(actor.id),
            )
            await inventory.insert()
        else:
            inventory.product_name_snapshot = product_name
            inventory.brand_name_snapshot = brand_name
            inventory.category = (category or inventory.category or "General").strip() or "General"
            inventory.min_threshold = min_threshold
            inventory.buying_price = buying_price
            inventory.updated_by = str(actor.id)
            await inventory.save()

        tx = InventoryTransaction(
            salon_id=salon_id,
            product_id=resolved_product_id,
            brand_id=resolved_brand_id,
            type="PURCHASE",
            transaction_type="PURCHASE",
            quantity=quantity,
            quantity_change=quantity,
            price=buying_price,
            unit_cost=buying_price,
            notes=notes,
            created_by=str(actor.id),
        )
        await tx.insert()
        inventory = await self._sync_product_inventory(inventory)

        salon_product = await SalonProduct.find_one(
            {
                "salon_id": salon_id,
                "product_id": resolved_product_id,
                "brand_id": resolved_brand_id,
                "is_deleted": False,
            }
        )
        if not salon_product:
            await self.salon_product_service.create_salon_product(
                actor,
                SalonProductCreate(
                    product_id=resolved_product_id,
                    brand_id=resolved_brand_id,
                    price=buying_price,
                ),
                salon_id=salon_id,
            )

        return self._inventory_to_item(inventory)

    async def record_use(
        self,
        actor: User,
        salon_id: str,
        quantity: int,
        inventory_id: str | None = None,
        product_id: str | None = None,
        brand_id: str | None = None,
        tx_type: str = "USAGE",
        reference_id: str | None = None,
        notes: str | None = None,
    ) -> InventoryStockItem:
        normalized_type = (tx_type or "USAGE").upper()
        if normalized_type not in {"USAGE", "SALE"}:
            normalized_type = "USAGE"

        inventory = None
        if inventory_id:
            inventory = await ProductInventory.find_one(
                ProductInventory.id == PydanticObjectId(inventory_id),
                ProductInventory.salon_id == salon_id,
                ProductInventory.is_deleted == False,
            )
        elif product_id:
            inventory = await ProductInventory.find_one(
                {
                    "salon_id": salon_id,
                    "product_id": product_id,
                    "brand_id": brand_id,
                    "is_deleted": False,
                }
            )
        if not inventory:
            raise ResourceNotFoundException("Inventory product not found")

        current_stock = await self.calculate_product_stock(
            salon_id,
            inventory.product_id,
            inventory.brand_id,
        )
        if current_stock < quantity:
            raise InsufficientStockException(
                f"Insufficient stock for {self._display_name(inventory.product_name_snapshot, inventory.brand_name_snapshot)}. Available: {current_stock}, requested: {quantity}"
            )

        tx = InventoryTransaction(
            salon_id=salon_id,
            product_id=inventory.product_id,
            brand_id=inventory.brand_id,
            type=normalized_type,
            transaction_type=normalized_type,
            quantity=quantity,
            quantity_change=-quantity,
            price=inventory.buying_price,
            unit_cost=inventory.buying_price,
            reference_id=reference_id,
            notes=notes,
            created_by=str(actor.id),
        )
        await tx.insert()
        inventory = await self._sync_product_inventory(inventory)
        return self._inventory_to_item(inventory)

    async def deduct_sold_product(
        self,
        salon_id: str,
        product_id: str,
        brand_id: str | None,
        quantity: int,
        reference_id: str | None,
    ) -> None:
        inventory = await ProductInventory.find_one(
            {
                "salon_id": salon_id,
                "product_id": product_id,
                "brand_id": brand_id,
                "is_deleted": False,
            }
        )
        if not inventory:
            return
        current_stock = await self.calculate_product_stock(
            salon_id,
            inventory.product_id,
            inventory.brand_id,
        )
        if current_stock < quantity:
            raise InsufficientStockException(
                f"Insufficient stock for {self._display_name(inventory.product_name_snapshot, inventory.brand_name_snapshot)}"
            )
        tx = InventoryTransaction(
            salon_id=salon_id,
            product_id=inventory.product_id,
            brand_id=inventory.brand_id,
            type="SALE",
            transaction_type="SALE",
            quantity=quantity,
            quantity_change=-quantity,
            price=inventory.buying_price,
            unit_cost=inventory.buying_price,
            reference_id=reference_id,
            notes="Auto deducted from appointment billing",
        )
        await tx.insert()
        await self._sync_product_inventory(inventory)

    async def overview(self, salon_id: str) -> InventoryOverview:
        stocks = await self.list_stocks(salon_id)
        category_map: dict[str, int] = {}
        brand_map: dict[str, int] = {}
        warnings = []
        for item in stocks:
            category_map[item.category] = category_map.get(item.category, 0) + 1
            brand_label = item.brand_name or "Unbranded"
            brand_map[brand_label] = brand_map.get(brand_label, 0) + 1
            if item.status in {"LOW", "CRITICAL"}:
                daily_usage = await self._average_daily_usage(
                    salon_id,
                    item.product_id,
                    item.brand_id,
                )
                days_left = int(item.stock_quantity / daily_usage) if daily_usage > 0 else 0
                warnings.append(
                    {
                        "inventory_id": item.id,
                        "product_name": item.display_name,
                        "status": item.status,
                        "message": f"Stock will end in {days_left} days - Reorder required",
                    }
                )

        usage_trend = await self._usage_trend(salon_id)
        return InventoryOverview(
            total_products=len(stocks),
            low_stock_alerts=sum(1 for item in stocks if item.status == "LOW"),
            critical_alerts=sum(1 for item in stocks if item.status == "CRITICAL"),
            category_breakdown=[
                {"category": key, "count": value} for key, value in sorted(category_map.items())
            ],
            brand_distribution=[
                {"brand": key, "count": value} for key, value in sorted(brand_map.items())
            ],
            usage_trend=usage_trend,
            warnings=warnings,
        )

    async def _average_daily_usage(
        self,
        salon_id: str,
        product_id: str,
        brand_id: str | None,
    ) -> float:
        since = datetime.now(timezone.utc) - timedelta(days=30)
        transactions = await InventoryTransaction.find(
            {
                "salon_id": salon_id,
                "product_id": product_id,
                "brand_id": brand_id,
                "type": {"$in": ["USAGE", "SALE"]},
                "created_at": {"$gte": since},
                "is_deleted": False,
            }
        ).to_list()
        used = sum(tx.quantity or abs(tx.quantity_change or 0) for tx in transactions)
        return used / 30 if used else 0

    async def _usage_trend(self, salon_id: str) -> list[dict]:
        since = datetime.now(timezone.utc) - timedelta(days=6)
        transactions = await InventoryTransaction.find(
            {
                "salon_id": salon_id,
                "type": {"$in": ["USAGE", "SALE"]},
                "created_at": {"$gte": datetime.combine(since.date(), time.min, tzinfo=timezone.utc)},
                "is_deleted": False,
            }
        ).to_list()
        buckets = {
            (since.date() + timedelta(days=offset)).isoformat(): 0
            for offset in range(7)
        }
        for tx in transactions:
            key = tx.created_at.date().isoformat()
            if key in buckets:
                buckets[key] += tx.quantity or abs(tx.quantity_change or 0)
        return [{"date": key, "quantity": value} for key, value in buckets.items()]

    async def reports(
        self,
        salon_id: str,
        start_date: str | None = None,
        end_date: str | None = None,
        category: str | None = None,
        brand: str | None = None,
    ) -> InventoryReports:
        query: dict[str, Any] = {"salon_id": salon_id, "is_deleted": False}
        if start_date or end_date:
            query["created_at"] = {}
            if start_date:
                query["created_at"]["$gte"] = datetime.combine(
                    datetime.strptime(start_date, "%Y-%m-%d").date(),
                    time.min,
                    tzinfo=timezone.utc,
                )
            if end_date:
                query["created_at"]["$lte"] = datetime.combine(
                    datetime.strptime(end_date, "%Y-%m-%d").date(),
                    time.max,
                    tzinfo=timezone.utc,
                )
        transactions = await InventoryTransaction.find(query).sort("-created_at").limit(200).to_list()
        stocks = await self.list_stocks(salon_id, category=category, brand=brand)
        product_lookup = {(item.product_id, item.brand_id): item for item in stocks}

        total_purchase_cost = 0.0
        usage_cost_summary = 0.0
        category_consumption: dict[str, int] = {}
        brand_spending: dict[str, float] = {}
        filtered_transactions = []
        for tx in transactions:
            item = product_lookup.get((tx.product_id, tx.brand_id))
            if (category or brand) and not item:
                continue
            filtered_transactions.append(tx)
            quantity = tx.quantity or abs(tx.quantity_change or 0)
            price = tx.price if tx.price is not None else tx.unit_cost
            if tx.type == "PURCHASE":
                amount = quantity * price
                total_purchase_cost += amount
                brand_label = item.brand_name if item and item.brand_name else "Unbranded"
                brand_spending[brand_label] = brand_spending.get(brand_label, 0.0) + amount
            if tx.type in {"USAGE", "SALE"}:
                amount = quantity * price
                usage_cost_summary += amount
                category_label = item.category if item else "General"
                category_consumption[category_label] = category_consumption.get(category_label, 0) + quantity

        return InventoryReports(
            total_purchase_cost=round(total_purchase_cost, 2),
            usage_cost_summary=round(usage_cost_summary, 2),
            profit_impact_estimation=round(total_purchase_cost - usage_cost_summary, 2),
            category_consumption=[
                {"category": key, "quantity": value}
                for key, value in sorted(category_consumption.items())
            ],
            brand_spending=[
                {"brand": key, "amount": round(value, 2)}
                for key, value in sorted(brand_spending.items())
            ],
            transactions=[self._transaction_to_item(tx) for tx in filtered_transactions],
        )

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
