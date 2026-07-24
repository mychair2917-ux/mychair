"""Centralized RBAC: roles, modules, and permission mappings."""

from enum import Enum
from typing import FrozenSet, Optional

ROLE_SUPER_ADMIN = "super_admin"
ROLE_SALON_OWNER = "salon_owner"
ROLE_SALON_ADMIN = "salon_admin"
ROLE_SALON_MANAGER = "salon_manager"
ROLE_EMPLOYEE = "employee"

# Legacy / alias roles normalized at runtime
ROLE_ALIASES = {
    "admin": ROLE_SALON_ADMIN,
    "standard": ROLE_EMPLOYEE,
}

ALL_ROLES: FrozenSet[str] = frozenset(
    {
        ROLE_SUPER_ADMIN,
        ROLE_SALON_OWNER,
        ROLE_SALON_ADMIN,
        ROLE_SALON_MANAGER,
        ROLE_EMPLOYEE,
    }
)

TENANT_SCOPED_ROLES: FrozenSet[str] = frozenset(
    {ROLE_SALON_OWNER, ROLE_SALON_ADMIN, ROLE_SALON_MANAGER, ROLE_EMPLOYEE}
)


class Module(str, Enum):
    DASHBOARD = "dashboard"
    INVITE = "invite"
    APPOINTMENTS = "appointments"
    MY_EARNINGS = "my_earnings"
    SALON_MANAGEMENT = "salon_management"
    EMPLOYEES = "employees"
    SERVICES = "services"
    USER_MANAGEMENT = "user_management"
    ROLES_PERMISSIONS = "roles_permissions"
    SUBSCRIPTION_MANAGEMENT = "subscription_management"
    BILLING_FINANCE = "billing_finance"
    PRODUCTS_INVENTORY = "products_inventory"
    STAFF_MONITORING = "staff_monitoring"
    ATTENDANCE = "attendance"
    LEAVE = "leave"
    CUSTOMER_ANALYTICS = "customer_analytics"
    NOTIFICATIONS_COMMUNICATION = "notifications_communication"
    PROFILE = "profile"
    SETTINGS = "settings"


# Module access per normalized role (super_admin uses platform admin routes separately)
ROLE_MODULE_ACCESS: dict[str, FrozenSet[Module]] = {
    ROLE_SUPER_ADMIN: frozenset(Module),
    ROLE_SALON_OWNER: frozenset(Module),
    ROLE_SALON_ADMIN: frozenset(
        m
        for m in Module
        if m not in (Module.SUBSCRIPTION_MANAGEMENT,)
    ),
    ROLE_SALON_MANAGER: frozenset(
        {
            Module.DASHBOARD,
            Module.INVITE,
            Module.APPOINTMENTS,
            Module.MY_EARNINGS,
            Module.SALON_MANAGEMENT,
            Module.EMPLOYEES,
            Module.SERVICES,
            Module.PRODUCTS_INVENTORY,
            Module.CUSTOMER_ANALYTICS,
            Module.NOTIFICATIONS_COMMUNICATION,
            Module.ATTENDANCE,
            Module.LEAVE,
            Module.NOTIFICATIONS_COMMUNICATION,
            Module.PROFILE,
        }
    ),
    ROLE_EMPLOYEE: frozenset(
        {
            Module.DASHBOARD,
            Module.MY_EARNINGS,
            Module.ATTENDANCE,
            Module.LEAVE,
            Module.PROFILE,
        }
    ),
}

EMPLOYEE_TABLE_ROLES: FrozenSet[str] = frozenset({ROLE_SALON_ADMIN, ROLE_SALON_MANAGER, ROLE_EMPLOYEE})


def normalize_role(role: Optional[str]) -> Optional[str]:
    if not role:
        return None
    return ROLE_ALIASES.get(role, role)


def can_access_module(role: Optional[str], module: Module) -> bool:
    normalized = normalize_role(role)
    if not normalized:
        return False
    allowed = ROLE_MODULE_ACCESS.get(normalized)
    if not allowed:
        return False
    return module in allowed


def assert_can_access_module(role: Optional[str], module: Module) -> None:
    from app.core.exceptions import PermissionDeniedException

    if not can_access_module(role, module):
        raise PermissionDeniedException(
            detail=f"Role '{role}' is not permitted to access '{module.value}'"
        )


def can_view_invite(actor_role: str) -> bool:
    return can_access_module(actor_role, Module.INVITE)


def invite_list_roles_visible(actor_role: str) -> Optional[FrozenSet[str]]:
    """None = all target roles; otherwise filter invites to these invitee roles."""
    normalized = normalize_role(actor_role)
    if normalized == ROLE_SUPER_ADMIN:
        return None
    if normalized in (ROLE_SALON_OWNER, ROLE_SALON_ADMIN):
        return frozenset({ROLE_SALON_MANAGER, ROLE_EMPLOYEE})
    if normalized == ROLE_SALON_MANAGER:
        return frozenset({ROLE_EMPLOYEE})
    return frozenset()


def employee_list_roles_visible(actor_role: str) -> FrozenSet[str]:
    """Roles shown on the Employees page for this actor."""
    normalized = normalize_role(actor_role)
    if normalized in (ROLE_SUPER_ADMIN, ROLE_SALON_OWNER, ROLE_SALON_ADMIN):
        return EMPLOYEE_TABLE_ROLES
    if normalized == ROLE_SALON_MANAGER:
        # Managers can see only staff employees under them
        return frozenset({ROLE_EMPLOYEE})
    return frozenset()


def invite_list_scoped_to_inviter(actor_role: str) -> bool:
    """Non–super-admin users only see invitations they personally sent."""
    return normalize_role(actor_role) != ROLE_SUPER_ADMIN
