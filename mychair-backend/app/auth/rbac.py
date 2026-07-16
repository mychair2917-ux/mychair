from typing import Optional
from app.models.permissions import VALID_ROLES, ROLE_USER_PERMISSIONS
from app.core.exceptions import PermissionDeniedException


def assert_valid_role(role: str) -> None:
    if role not in VALID_ROLES:
        raise PermissionDeniedException(detail=f"Invalid role: {role}")


def can_create_role(creator_role: str, new_role: str) -> bool:
    """Role hierarchy for user creation."""
    if new_role == "salon_owner":
        return creator_role == "super_admin"
    if creator_role == "salon_owner":
        return new_role in ("salon_manager", "employee")

    assert_valid_role(creator_role)
    assert_valid_role(new_role)

    if creator_role == "employee":
        return False
    if new_role == "super_admin":
        return creator_role == "super_admin"
    if new_role == "salon_admin":
        return creator_role == "super_admin"
    if new_role == "salon_manager":
        return creator_role in ("super_admin", "salon_admin")
    if new_role == "employee":
        return creator_role in ("super_admin", "salon_admin", "salon_manager")
    return False


def can_manage_user(actor_role: str, target_role: str, action: str) -> bool:
    """
    Whether actor may perform action on a user with target_role.
    action: create | update | delete | list
    """
    if actor_role == "super_admin":
        return True
    if action == "list":
        return actor_role in ("salon_admin", "salon_manager")
    if action == "delete":
        return actor_role == "salon_admin"
    if action == "create":
        return can_create_role(actor_role, target_role)
    if action == "update":
        if actor_role == "employee":
            return False
        if actor_role == "salon_manager":
            return target_role == "employee"
        if actor_role == "salon_admin":
            return target_role in ("salon_manager", "employee")
    return False


def require_user_permission(actor_role: str, permission: str) -> None:
    allowed = ROLE_USER_PERMISSIONS.get(actor_role, set())
    if permission not in allowed:
        raise PermissionDeniedException(
            detail=f"Role '{actor_role}' cannot perform '{permission}'"
        )
