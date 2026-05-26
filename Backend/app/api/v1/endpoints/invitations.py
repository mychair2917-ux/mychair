from typing import Optional

from fastapi import APIRouter, Depends, Query

from app.api.dependencies.invitation import get_invite_actor
from app.api.dependencies.super_admin import require_super_admin
from app.models.user import User
from app.schemas.invitation import (
    AcceptInviteRequest,
    CancelInviteRequest,
    CreateInvitationRequest,
    CreateInviteRequest,
    CreatePasswordRequest,
    ResendInviteRequest,
)
from app.services.invite_service import InviteService
from app.services.invitation_service import InvitationService
from app.utils.api_response import error_response, success_response

router = APIRouter()
invite_service = InviteService()
legacy_invitation_service = InvitationService()


@router.get("/form-options")
async def get_invitation_form_options(actor: User = Depends(get_invite_actor)):
    """Dynamic form options based on inviter role."""
    return success_response(
        "Form options retrieved successfully",
        data=await invite_service.get_form_options(actor),
    )


@router.get("")
async def list_invites(
    status: Optional[str] = Query(
        default=None,
        description="Filter by status: pending, accepted, expired, cancelled",
    ),
    actor: User = Depends(get_invite_actor),
):
    """
    List invitations visible to the current user.
    super_admin sees all; salon owner/admin sees their salon;
    manager sees staff invites for their salon.
    """
    data = await invite_service.list_invites(actor, status=status)
    return success_response("Invitations retrieved successfully", data=data)


@router.post("")
async def create_invite(
    payload: CreateInviteRequest,
    actor: User = Depends(get_invite_actor),
):
    data, errors = await invite_service.create_invite(actor, payload)
    if errors:
        return error_response("Please correct the errors below", errors=errors, status_code=400)
    return success_response("Invitation sent successfully", data=data, status_code=201)


@router.post("/accept")
async def accept_invitation(payload: AcceptInviteRequest):
    data, errors = await invite_service.accept_invite(
        token=payload.token,
        password=payload.password,
        confirm_password=payload.confirm_password,
    )
    if errors:
        return error_response("Please correct the errors below", errors=errors, status_code=400)
    return success_response(
        "Password created successfully. You can now log in.",
        data=data,
    )


@router.post("/resend")
async def resend_invitation(
    payload: ResendInviteRequest,
    actor: User = Depends(get_invite_actor),
):
    data, error_message = await invite_service.resend_invite(actor, payload.invite_id)
    if error_message:
        return error_response(error_message, status_code=400)
    return success_response("Invitation resent successfully", data=data)


@router.post("/cancel")
async def cancel_invitation(
    payload: CancelInviteRequest,
    actor: User = Depends(get_invite_actor),
):
    data, error_message = await invite_service.cancel_invite(actor, payload.invite_id)
    if error_message:
        return error_response(error_message, status_code=400)
    return success_response("Invitation cancelled successfully", data=data)


# --- Legacy salon-owner-only endpoints (backward compatible) ---


@router.post("/legacy")
async def create_invitation_legacy(
    payload: CreateInvitationRequest,
    _: User = Depends(require_super_admin),
):
    data, errors = await legacy_invitation_service.create_invitation(
        salon_name=payload.salon_name,
        owner_full_name=payload.owner_full_name,
        email=payload.email,
        owner_phone_number=payload.owner_phone_number,
        salon_phone_number=payload.salon_phone_number,
        salon_type=payload.salon_type,
        branch_name=payload.branch_name,
        address=payload.address,
        subscription_plan=payload.subscription_plan,
        slug=payload.slug,
        username=payload.username,
    )
    if errors:
        return error_response("Please correct the errors below", errors=errors, status_code=400)
    return success_response("Invitation sent successfully", data=data, status_code=201)


@router.get("/{token}")
async def validate_invitation_token(token: str):
    data, error_message = await invite_service.validate_token(token)
    if error_message:
        return error_response(error_message, status_code=400)
    return success_response("Invitation token is valid", data=data)


@router.post("/create-password")
async def create_password(payload: CreatePasswordRequest):
    data, errors = await invite_service.accept_invite(
        token=payload.token,
        password=payload.password,
        confirm_password=payload.confirm_password,
    )
    if errors:
        return error_response("Please correct the errors below", errors=errors, status_code=400)
    return success_response("Password created successfully. You can now log in.", data=data)
