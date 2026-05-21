from enum import Enum
from typing import Dict, FrozenSet, Set

# Exactly four roles — no additional roles
VALID_ROLES: FrozenSet[str] = frozenset(
    {"super_admin", "salon_admin", "salon_manager", "employee"}
)


class Permission(str, Enum):
    CREATE_USER = "create_user"
    UPDATE_USER = "update_user"
    DELETE_USER = "delete_user"
    ASSIGN_ROLE = "assign_role"
    LIST_USERS = "list_users"


# Default user-management permissions per role
ROLE_USER_PERMISSIONS: Dict[str, Set[str]] = {
    "super_admin": {p.value for p in Permission},
    "salon_admin": {
        Permission.CREATE_USER.value,
        Permission.UPDATE_USER.value,
        Permission.DELETE_USER.value,
        Permission.ASSIGN_ROLE.value,
        Permission.LIST_USERS.value,
    },
    "salon_manager": {
        Permission.CREATE_USER.value,
        Permission.UPDATE_USER.value,
        Permission.LIST_USERS.value,
    },
    "employee": set(),
}

# Feature permissions for appointments, billing, inventory, etc.
ROLE_FEATURE_PERMISSIONS: Dict[str, Set[str]] = {
    "super_admin": {"*"},
    "salon_admin": {
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
        "crm.manage",
    },
    "salon_manager": {
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
        "crm.manage",
    },
    "employee": {
        "appointments.view",
        "attendance.create",
        "inventory.view",
    },
}
