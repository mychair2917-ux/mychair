from fastapi import APIRouter, Depends, Query

from app.api.dependencies.rbac import require_any_module
from app.auth.rbac_config import Module
from app.models.user import User
from app.services.brand import BrandService
from app.utils.api_response import success_response

router = APIRouter()
brand_service = BrandService()


@router.get("/brands")
async def list_brands(
    salon_id: str | None = Query(default=None),
    search: str | None = Query(default=None),
    current_user: User = Depends(
        require_any_module(Module.PRODUCTS_INVENTORY, Module.SERVICES)
    ),
):
    items = await brand_service.list_brands(current_user, salon_id=salon_id, search=search)
    return success_response(
        "Brands retrieved successfully",
        data=[item.model_dump(mode="json") for item in items],
    )
