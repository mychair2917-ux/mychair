"""RBAC FastAPI dependencies for module and tenant enforcement."""

from typing import Callable

from fastapi import Depends, Path

from app.api.dependencies.auth import get_current_user
from app.auth.rbac_config import Module, assert_can_access_module, normalize_role
from app.core.exceptions import PermissionDeniedException, TenantAccessDeniedException
from app.models.user import User

ROLE_SUPER_ADMIN = "super_admin"


def require_module(module: Module) -> Callable:
    """Dependency factory: current user must have access to the given module."""

    async def _checker(current_user: User = Depends(get_current_user)) -> User:
        assert_can_access_module(current_user.role, module)
        return current_user

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
