from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies.rbac import require_module
from app.auth.rbac_config import Module
from app.models.user import User
from app.schemas.salon_product import SalonProductCreate, SalonProductUpdate
from app.services.salon_product import SalonProductService
from app.utils.api_response import success_response

router = APIRouter()
salon_product_service = SalonProductService()


@router.get("/products")
async def list_master_products(
    current_user: User = Depends(require_module(Module.PRODUCTS_INVENTORY)),
):
    items = await salon_product_service.list_master_products(current_user)
    return success_response(
        "Products retrieved successfully",
        data=[item.model_dump(mode="json") for item in items],
    )


@router.get("/salon-products")
async def list_salon_products(
    salon_id: str | None = Query(default=None),
    current_user: User = Depends(require_module(Module.PRODUCTS_INVENTORY)),
):
    items = await salon_product_service.list_salon_products(current_user, salon_id=salon_id)
    return success_response(
        "Salon products retrieved successfully",
        data=[item.model_dump(mode="json") for item in items],
    )


@router.post("/salon-products", status_code=status.HTTP_201_CREATED)
async def create_salon_product(
    payload: SalonProductCreate,
    salon_id: str | None = Query(default=None),
    current_user: User = Depends(require_module(Module.PRODUCTS_INVENTORY)),
):
    item = await salon_product_service.create_salon_product(
        current_user, payload, salon_id=salon_id
    )
    return success_response(
        "Salon product added successfully",
        data=item.model_dump(mode="json"),
        status_code=201,
    )


@router.put("/salon-products/{salon_product_id}")
async def update_salon_product(
    salon_product_id: str,
    payload: SalonProductUpdate,
    salon_id: str | None = Query(default=None),
    current_user: User = Depends(require_module(Module.PRODUCTS_INVENTORY)),
):
    item = await salon_product_service.update_salon_product(
        current_user,
        salon_product_id,
        payload,
        salon_id=salon_id,
    )
    return success_response(
        "Salon product updated successfully",
        data=item.model_dump(mode="json"),
    )


@router.delete("/salon-products/{salon_product_id}")
async def delete_salon_product(
    salon_product_id: str,
    salon_id: str | None = Query(default=None),
    current_user: User = Depends(require_module(Module.PRODUCTS_INVENTORY)),
):
    await salon_product_service.delete_salon_product(
        current_user, salon_product_id, salon_id=salon_id
    )
    return success_response("Salon product deleted successfully", data=None)
