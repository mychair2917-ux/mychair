from app.models.permissions import ROLE_FEATURE_PERMISSIONS
from app.core.exceptions import PermissionDeniedException


def has_permission(user_role: str, required_permission: str) -> bool:
    allowed = ROLE_FEATURE_PERMISSIONS.get(user_role, set())
    if "*" in allowed:
        return True
    return required_permission in allowed


def verify_role_has_permission(user_role: str, required_permission: str) -> None:
    if not has_permission(user_role, required_permission):
        raise PermissionDeniedException(
            detail=f"Action denied: Role '{user_role}' requires '{required_permission}' permission"
        )
