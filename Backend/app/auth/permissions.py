from typing import List, Dict, Set
from app.core.exceptions import PermissionDeniedException

# Granular Permission mapping for all system roles
ROLE_PERMISSIONS: Dict[str, Set[str]] = {
    "system_admin": {
        "*"  # Superuser bypass
    },
    "owner": {
        "appointments.create",
        "appointments.view",
        "appointments.cancel",
        "inventory.edit",
        "inventory.view",
        "billing.create",
        "billing.refund",
        "billing.view",
        "staff.manage",
        "salon.manage",
        "attendance.view",
        "attendance.manage",
        "analytics.view",
        "crm.manage"
    },
    "manager": {
        "appointments.create",
        "appointments.view",
        "appointments.cancel",
        "inventory.edit",
        "inventory.view",
        "billing.create",
        "billing.view",
        "staff.manage",
        "attendance.view",
        "attendance.manage",
        "analytics.view",
        "crm.manage"
    },
    "receptionist": {
        "appointments.create",
        "appointments.view",
        "appointments.cancel",
        "inventory.view",
        "billing.create",
        "billing.view",
        "attendance.view",
        "crm.manage"
    },
    "stylist": {
        "appointments.view",
        "attendance.create",
        "inventory.view",
    }
}

def has_permission(user_role: str, required_permission: str) -> bool:
    """Verifies if the user's role satisfies the required action permission."""
    allowed_permissions = ROLE_PERMISSIONS.get(user_role, set())
    if "*" in allowed_permissions:
        return True
    return required_permission in allowed_permissions

def verify_role_has_permission(user_role: str, required_permission: str) -> None:
    """Raises PermissionDeniedException if the user role is not authorized."""
    if not has_permission(user_role, required_permission):
        raise PermissionDeniedException(
            detail=f"Action denied: Role '{user_role}' requires '{required_permission}' permission"
        )
