from fastapi import APIRouter, Depends

from app.api.dependencies.salon_owner_auth import get_current_salon_owner
from app.models.user import User
from app.services.salon_owner_auth_service import SalonOwnerAuthService
from app.utils.api_response import success_response, error_response

router = APIRouter()
auth_service = SalonOwnerAuthService()


@router.get("/profile")
async def get_salon_owner_profile(
    current_owner: User = Depends(get_current_salon_owner),
):
    data, error_message = await auth_service.get_profile(str(current_owner.id))
    if error_message:
        return error_response(error_message, status_code=404)
    return success_response("Profile retrieved successfully", data=data)
