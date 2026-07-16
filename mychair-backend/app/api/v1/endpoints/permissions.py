from fastapi import APIRouter, Depends

from app.api.dependencies.auth import get_current_user
from app.models.user import User
from app.schemas.permissions import (
    FinalPermissionsResponse,
    RolePermissionsResponse,
    UpdatePermissionsRequest,
    UserPermissionsResponse,
)
from app.services.permission_service import PermissionService
from app.utils.api_response import success_response

router = APIRouter()
permission_service = PermissionService()


@router.get("/registry")
async def get_permission_registry(
    current_user: User = Depends(get_current_user),
):
    registry = permission_service.get_registry()
    return success_response("Permission registry fetched", data=registry)


@router.get("/me")
async def get_my_permissions(
    current_user: User = Depends(get_current_user),
):
    perms = await permission_service.get_merged_permissions(current_user)
    return success_response(
        "Permissions fetched",
        data=FinalPermissionsResponse(
            role=current_user.role,
            permissions=perms,
        ).model_dump(),
    )


@router.get("/roles/{role}")
async def get_role_permissions(
    role: str,
    current_user: User = Depends(get_current_user),
):
    defaults, overrides, effective = await permission_service.get_role_permissions(
        current_user, role
    )
    return success_response(
        "Role permissions fetched",
        data=RolePermissionsResponse(
            role=role,
            defaults=defaults,
            overrides=overrides,
            effective=effective,
        ).model_dump(),
    )


@router.put("/roles/{role}")
async def update_role_permissions(
    role: str,
    payload: UpdatePermissionsRequest,
    current_user: User = Depends(get_current_user),
):
    effective = await permission_service.update_role_permissions(
        current_user, role, payload.permissions
    )
    return success_response(
        "Role permissions updated",
        data={"role": role, "effective": effective},
    )


@router.get("/users/{user_id}")
async def get_user_permissions(
    user_id: str,
    current_user: User = Depends(get_current_user),
):
    target = await User.get(user_id)
    defaults, overrides, effective = await permission_service.get_user_permissions(
        current_user, user_id
    )
    return success_response(
        "User permissions fetched",
        data=UserPermissionsResponse(
            user_id=user_id,
            role=target.role if target else "",
            defaults=defaults,
            overrides=overrides,
            effective=effective,
        ).model_dump(),
    )


@router.put("/users/{user_id}")
async def update_user_permissions(
    user_id: str,
    payload: UpdatePermissionsRequest,
    current_user: User = Depends(get_current_user),
):
    effective = await permission_service.update_user_permissions(
        current_user, user_id, payload.permissions
    )
    return success_response(
        "User permissions updated",
        data={"user_id": user_id, "effective": effective},
    )
