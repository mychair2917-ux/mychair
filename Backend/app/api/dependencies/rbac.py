"""RBAC FastAPI dependencies for module and tenant enforcement."""

from typing import Callable, Dict

from fastapi import Depends, Path

from app.api.dependencies.auth import get_current_user
from app.auth.module_permission_registry import can_access_permission
from app.auth.rbac_config import Module, normalize_role
from app.core.exceptions import PermissionDeniedException, TenantAccessDeniedException
from app.models.user import User
from app.services.permission_service import PermissionService

ROLE_SUPER_ADMIN = "super_admin"
_permission_service = PermissionService()


async def get_merged_permissions(
    current_user: User = Depends(get_current_user),
) -> Dict[str, bool]:
    return await _permission_service.get_merged_permissions(current_user)


def _can_access_module(
    role: str,
    module: Module,
    merged_permissions: Dict[str, bool],
) -> bool:
    return can_access_permission(role, module.value, merged_permissions)


def require_module(module: Module) -> Callable:
    """Dependency factory: current user must have access to the given module."""

    async def _checker(
        current_user: User = Depends(get_current_user),
        merged_permissions: Dict[str, bool] = Depends(get_merged_permissions),
    ) -> User:
        if not _can_access_module(current_user.role, module, merged_permissions):
            raise PermissionDeniedException(
                detail=f"Role '{current_user.role}' is not permitted to access '{module.value}'"
            )
        return current_user

    return _checker


def require_any_module(*modules: Module) -> Callable:
    """Dependency factory: current user must have access to at least one module."""

    async def _checker(
        current_user: User = Depends(get_current_user),
        merged_permissions: Dict[str, bool] = Depends(get_merged_permissions),
    ) -> User:
        if any(
            _can_access_module(current_user.role, module, merged_permissions)
            for module in modules
        ):
            return current_user
        allowed = ", ".join(module.value for module in modules)
        raise PermissionDeniedException(
            detail=f"Role '{current_user.role}' is not permitted to access any of: {allowed}"
        )

    return _checker


async def require_tenant_path_access(
    org_id: str = Path(..., alias="orgId"),
    current_user: User = Depends(get_current_user),
) -> User:
    """Ensure org-scoped routes match the user's tenant (super_admin exempt)."""
    normalized = normalize_role(current_user.role)
    if normalized == ROLE_SUPER_ADMIN:
        return current_user
    if not current_user.tenant_id or str(current_user.tenant_id) != org_id:
        raise TenantAccessDeniedException(
            detail="You do not have access to this organization's data"
        )
    return current_user


async def block_employee_invite_access(
    current_user: User = Depends(get_current_user),
) -> User:
    """Employees must not access invitation APIs."""
    normalized = normalize_role(current_user.role)
    if normalized == "employee":
        raise PermissionDeniedException(
            detail="Your role is not permitted to access invitations"
        )
    return current_user
