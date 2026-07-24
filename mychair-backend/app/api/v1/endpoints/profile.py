from pathlib import Path

from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import FileResponse

from app.api.dependencies.auth import get_current_user
from app.core.exceptions import ResourceNotFoundException
from app.models.user import User
from app.schemas.profile import (
    AvatarRemoveRequest,
    ChangePasswordRequest,
    ProfileUpdateRequest,
)
from app.services.profile_service import ProfileService
from app.utils.api_response import success_response

router = APIRouter()
profile_service = ProfileService()


@router.get("")
async def get_profile(
    current_user: User = Depends(get_current_user),
):
    profile = await profile_service.get_profile(current_user)
    return success_response(
        "Profile fetched successfully",
        data=profile.model_dump(mode="json"),
    )


@router.put("")
async def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
):
    profile = await profile_service.update_profile(current_user, payload)
    return success_response(
        "Profile updated successfully",
        data=profile.model_dump(mode="json"),
    )


@router.put("/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
):
    await profile_service.change_password(current_user, payload)
    return success_response("Password changed successfully", data={"updated": True})


@router.post("/avatar")
async def upload_avatar(
    avatar: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    profile = await profile_service.upload_avatar(current_user, avatar)
    return success_response(
        "Avatar updated successfully",
        data=profile.model_dump(mode="json"),
    )


@router.put("/avatar/remove")
async def remove_avatar(
    payload: AvatarRemoveRequest,
    current_user: User = Depends(get_current_user),
):
    if not payload.remove:
        return success_response("Avatar kept unchanged", data={"updated": False})
    profile = await profile_service.remove_avatar(current_user)
    return success_response(
        "Avatar removed successfully",
        data=profile.model_dump(mode="json"),
    )


@router.get("/avatar-files/{file_name}")
async def get_avatar_file(file_name: str):
    avatar_dir = profile_service.avatar_dir
    file_path = avatar_dir / file_name
    if not file_path.exists() or not file_path.is_file():
        raise ResourceNotFoundException(detail="Avatar file not found")
    media_type = "image/png" if file_path.suffix.lower() == ".png" else "image/jpeg"
    return FileResponse(Path(file_path), media_type=media_type)

