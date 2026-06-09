from fastapi import APIRouter, Depends, Query, status

from app.api.dependencies.rbac import require_module
from app.auth.rbac_config import Module
from app.models.user import User
from app.schemas.salon_service import SalonServiceCreate, SalonServiceUpdate
from app.services.salon_service import SalonServiceService
from app.utils.api_response import success_response

router = APIRouter()
salon_service_service = SalonServiceService()


@router.get("/services")
async def list_master_services(
    current_user: User = Depends(require_module(Module.SERVICES)),
):
    items = await salon_service_service.list_master_services()
    return success_response(
        "Services retrieved successfully",
        data=[item.model_dump(mode="json") for item in items],
    )


@router.get("/salon-services")
async def list_salon_services(
    salon_id: str | None = Query(default=None),
    current_user: User = Depends(require_module(Module.SERVICES)),
):
    items = await salon_service_service.list_salon_services(current_user, salon_id=salon_id)
    return success_response(
        "Salon services retrieved successfully",
        data=[item.model_dump(mode="json") for item in items],
    )


@router.post("/salon-services", status_code=status.HTTP_201_CREATED)
async def create_salon_service(
    payload: SalonServiceCreate,
    salon_id: str | None = Query(default=None),
    current_user: User = Depends(require_module(Module.SERVICES)),
):
    item = await salon_service_service.create_salon_service(
        current_user, payload, salon_id=salon_id
    )
    return success_response(
        "Salon service added successfully",
        data=item.model_dump(mode="json"),
        status_code=201,
    )


@router.put("/salon-services/{salon_service_id}")
async def update_salon_service(
    salon_service_id: str,
    payload: SalonServiceUpdate,
    salon_id: str | None = Query(default=None),
    current_user: User = Depends(require_module(Module.SERVICES)),
):
    item = await salon_service_service.update_salon_service(
        current_user,
        salon_service_id,
        payload,
        salon_id=salon_id,
    )
    return success_response(
        "Salon service updated successfully",
        data=item.model_dump(mode="json"),
    )


@router.delete("/salon-services/{salon_service_id}")
async def delete_salon_service(
    salon_service_id: str,
    salon_id: str | None = Query(default=None),
    current_user: User = Depends(require_module(Module.SERVICES)),
):
    await salon_service_service.delete_salon_service(
        current_user, salon_service_id, salon_id=salon_id
    )
    return success_response("Salon service deleted successfully", data=None)
