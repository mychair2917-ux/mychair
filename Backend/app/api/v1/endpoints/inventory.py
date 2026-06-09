from fastapi import APIRouter, Depends, Query, status
from typing import List
from app.api.dependencies.auth import PermissionChecker
from app.api.dependencies.rbac import require_module
from app.auth.rbac_config import Module
from app.models.user import User
from app.models.inventory import InventoryItem
from app.schemas.inventory import (
    InventoryItemCreate,
    InventoryPurchaseRequest,
    InventoryUseRequest,
    StockInRequest,
    StockReconciliationRequest,
)
from app.services.inventory import InventoryService
from app.repositories.inventory import InventoryItemRepository
from app.utils.api_response import success_response

router = APIRouter()
inventory_service = InventoryService()
item_repo = InventoryItemRepository()


@router.get("/overview")
async def get_inventory_overview(
    salon_id: str = Query(...),
    current_user: User = Depends(require_module(Module.PRODUCTS_INVENTORY)),
):
    data = await inventory_service.overview(salon_id)
    return success_response("Inventory overview retrieved successfully", data=data.model_dump(mode="json"))


@router.get("/stocks")
async def get_inventory_stocks(
    salon_id: str = Query(...),
    search: str | None = Query(default=None),
    category: str | None = Query(default=None),
    brand: str | None = Query(default=None),
    current_user: User = Depends(require_module(Module.PRODUCTS_INVENTORY)),
):
    data = await inventory_service.list_stocks(
        salon_id=salon_id,
        search=search,
        category=category,
        brand=brand,
    )
    return success_response(
        "Inventory stocks retrieved successfully",
        data=[item.model_dump(mode="json") for item in data],
    )


@router.post("/purchase", status_code=status.HTTP_201_CREATED)
async def create_inventory_purchase(
    payload: InventoryPurchaseRequest,
    salon_id: str = Query(...),
    current_user: User = Depends(require_module(Module.PRODUCTS_INVENTORY)),
):
    item = await inventory_service.record_purchase(
        actor=current_user,
        salon_id=salon_id,
        product_id=payload.product_id,
        custom_product_name=payload.custom_product_name,
        brand_id=payload.brand_id,
        custom_brand_name=payload.custom_brand_name,
        buying_price=payload.buying_price,
        quantity=payload.quantity,
        category=payload.category,
        min_threshold=payload.min_threshold,
        notes=payload.notes,
    )
    return success_response(
        "Inventory purchase recorded successfully",
        data=item.model_dump(mode="json"),
        status_code=201,
    )


@router.post("/use")
async def create_inventory_use(
    payload: InventoryUseRequest,
    salon_id: str = Query(...),
    current_user: User = Depends(require_module(Module.PRODUCTS_INVENTORY)),
):
    item = await inventory_service.record_use(
        actor=current_user,
        salon_id=salon_id,
        quantity=payload.quantity,
        inventory_id=payload.inventory_id,
        product_id=payload.product_id,
        brand_id=payload.brand_id,
        tx_type=payload.type,
        reference_id=payload.reference_id,
        notes=payload.notes,
    )
    return success_response(
        "Inventory deduction recorded successfully",
        data=item.model_dump(mode="json"),
    )


@router.get("/reports")
async def get_inventory_reports(
    salon_id: str = Query(...),
    start_date: str | None = Query(default=None),
    end_date: str | None = Query(default=None),
    category: str | None = Query(default=None),
    brand: str | None = Query(default=None),
    current_user: User = Depends(require_module(Module.PRODUCTS_INVENTORY)),
):
    data = await inventory_service.reports(
        salon_id=salon_id,
        start_date=start_date,
        end_date=end_date,
        category=category,
        brand=brand,
    )
    return success_response("Inventory reports retrieved successfully", data=data.model_dump(mode="json"))

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
