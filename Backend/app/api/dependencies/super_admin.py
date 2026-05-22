from fastapi import Depends

from app.api.dependencies.auth import get_current_user
from app.core.exceptions import PermissionDeniedException
from app.models.user import User


async def require_super_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if current_user.role != "super_admin":
        raise PermissionDeniedException("Only super admin can perform this action")
    return current_user
