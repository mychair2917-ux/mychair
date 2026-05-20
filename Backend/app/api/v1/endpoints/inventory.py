from fastapi import APIRouter, Depends, status
from typing import List
from app.api.dependencies.auth import PermissionChecker
from app.models.user import User
from app.models.inventory import InventoryItem
from app.schemas.inventory import StockInRequest, StockReconciliationRequest, InventoryItemCreate
from app.services.inventory import InventoryService
from app.repositories.inventory import InventoryItemRepository

router = APIRouter()
inventory_service = InventoryService()
item_repo = InventoryItemRepository()

@router.post("/", response_model=InventoryItem, status_code=status.HTTP_201_CREATED)
async def create_inventory_item(
    payload: InventoryItemCreate,
    current_user: User = Depends(PermissionChecker("inventory.edit"))
) -> InventoryItem:
    """Catalog Creation API to register a new product."""
    return await item_repo.create(payload)


@router.post("/{id}/restock", response_model=InventoryItem)
async def restock_product(
    id: str,
    salon_id: str,
    payload: StockInRequest,
    current_user: User = Depends(PermissionChecker("inventory.edit"))
) -> InventoryItem:
    """Adds stock inventory shipments and logs transactional ledgers."""
    return await inventory_service.add_stock(
        salon_id=salon_id,
        item_id=id,
        quantity=payload.quantity,
        unit_cost=payload.unit_cost,
        notes=payload.notes
    )


@router.post("/{id}/reconcile", response_model=InventoryItem)
async def reconcile_product(
    id: str,
    salon_id: str,
    payload: StockReconciliationRequest,
    current_user: User = Depends(PermissionChecker("inventory.edit"))
) -> InventoryItem:
    """
    Physical stocktake auditing API.
    Reconciles discrepancy differences and modifies stock audit logs.
    """
    return await inventory_service.reconcile_stock(
        salon_id=salon_id,
        item_id=id,
        physical_count=payload.physical_count,
        notes=payload.notes
    )


@router.get("/low-stock", response_model=List[InventoryItem])
async def get_low_stock_warnings(
    salon_id: str,
    current_user: User = Depends(PermissionChecker("inventory.view"))
) -> List[InventoryItem]:
    """Queries product catalogs showing quantities matching low stock alerts."""
    return await item_repo.get_low_stock_items(salon_id=salon_id)
