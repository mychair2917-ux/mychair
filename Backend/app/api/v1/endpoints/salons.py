from fastapi import APIRouter, Depends

from app.api.dependencies.super_admin import require_super_admin
from app.models.tenant import Tenant
from app.models.user import User
from app.utils.api_response import success_response

router = APIRouter()


@router.get("/list")
async def list_salons(current_user: User = Depends(require_super_admin)):
    tenants = await Tenant.find(Tenant.is_deleted == False).sort("name").to_list()
    data = [
        {
            "salon_id": str(tenant.id),
            "salon_name": tenant.name or "-",
        }
        for tenant in tenants
    ]
    return success_response("Salons retrieved successfully", data=data)
