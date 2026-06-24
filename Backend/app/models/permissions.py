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
    "salon_owner": {
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
        "attendance.create",
        "attendance.manage",
        "leave.view",
        "leave.create",
        "leave.approve",
        "analytics.view",
        "crm.manage",
        "customer_analytics.view",
        "customer_analytics.create",
        "customer_analytics.edit",
        "customer_analytics.delete",
        "notifications.view",
        "notifications.send",
        "notifications.campaigns",
        "notifications.templates.manage",
        "notifications.settings.manage",
        "notifications.logs.view",
    },
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
        "attendance.create",
        "attendance.manage",
        "leave.view",
        "leave.create",
        "analytics.view",
        "crm.manage",
        "customer_analytics.view",
        "customer_analytics.create",
        "customer_analytics.edit",
        "customer_analytics.delete",
        "notifications.view",
        "notifications.send",
        "notifications.campaigns",
        "notifications.templates.manage",
        "notifications.settings.manage",
        "notifications.logs.view",
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
        "attendance.create",
        "attendance.manage",
        "leave.view",
        "leave.create",
        "analytics.view",
        "crm.manage",
        "notifications.view",
        "notifications.send",
        "notifications.campaigns",
        "notifications.logs.view",
    },
    "employee": {
        "appointments.create",
        "appointments.view",
        "attendance.create",
        "leave.view",
        "leave.create",
        "inventory.view",
        "notifications.view",
    },
}
