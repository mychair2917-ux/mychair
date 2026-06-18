from typing import Dict, Optional

from fastapi import APIRouter, Depends, Query

from app.api.dependencies.rbac import get_merged_permissions, require_module
from app.auth.rbac_config import Module
from app.models.user import User
from app.services.dashboard_service import DashboardService
from app.utils.api_response import success_response

router = APIRouter()
dashboard_service = DashboardService()


@router.get("")
async def get_dashboard(
    salon_id: Optional[str] = Query(default=None, alias="salonId"),
    current_user: User = Depends(require_module(Module.DASHBOARD)),
    merged_permissions: Dict[str, bool] = Depends(get_merged_permissions),
):
    data = await dashboard_service.get_dashboard(
        current_user,
        salon_id=salon_id,
        merged_permissions=merged_permissions,
    )
    return success_response(
        "Dashboard loaded successfully",
        data=data.model_dump(mode="json"),
    )
