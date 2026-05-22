from fastapi import APIRouter, Depends

from app.api.dependencies.super_admin import require_super_admin
from app.models.user import User
from app.schemas.invitation import CreateInvitationRequest, CreatePasswordRequest
from app.services.invitation_service import InvitationService
from app.utils.api_response import success_response, error_response

router = APIRouter()
invitation_service = InvitationService()


@router.post("")
async def create_invitation(
    payload: CreateInvitationRequest,
    _: User = Depends(require_super_admin),
):
    data, errors = await invitation_service.create_invitation(
        salon_name=payload.salon_name,
        slug=payload.slug,
        email=payload.email,
        username=payload.username,
        address=payload.address,
    )
    if errors:
        return error_response("Validation failed", errors=errors, status_code=400)
    return success_response("Invitation sent successfully", data=data, status_code=201)


@router.get("/{token}")
async def validate_invitation_token(token: str):
    data, error_message = await invitation_service.validate_token(token)
    if error_message:
        return error_response(error_message, status_code=400)
    return success_response("Invitation token is valid", data=data)


@router.post("/create-password")
async def create_password(payload: CreatePasswordRequest):
    data, errors = await invitation_service.create_password(
        token=payload.token,
        password=payload.password,
        confirm_password=payload.confirm_password,
    )
    if errors:
        return error_response("Validation failed", errors=errors, status_code=400)
    return success_response("Password created successfully. You can now log in.", data=data)
