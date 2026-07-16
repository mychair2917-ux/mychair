"""Central registry of module permission keys aligned with frontend sidebar modules."""

from typing import Any, Dict, List, Optional

from app.auth.rbac_config import Module, ROLE_MODULE_ACCESS, normalize_role

# Billing sub-module keys (nested under billing_finance in sidebar)
BILLING_BILLS = "billing_bills"
BILLING_PAYROLL = "billing_payroll"
BILLING_EXPENSES = "billing_expenses"

# All permission keys used for sidebar / route access
ALL_PERMISSION_KEYS: tuple[str, ...] = (
    Module.DASHBOARD.value,
    Module.INVITE.value,
    Module.APPOINTMENTS.value,
    Module.MY_EARNINGS.value,
    Module.SALON_MANAGEMENT.value,
    Module.EMPLOYEES.value,
    Module.SERVICES.value,
    Module.USER_MANAGEMENT.value,
    Module.SUBSCRIPTION_MANAGEMENT.value,
    Module.BILLING_FINANCE.value,
    BILLING_BILLS,
    BILLING_PAYROLL,
    BILLING_EXPENSES,
    Module.PRODUCTS_INVENTORY.value,
    Module.STAFF_MONITORING.value,
    Module.ATTENDANCE.value,
    Module.LEAVE.value,
    Module.CUSTOMER_ANALYTICS.value,
    Module.NOTIFICATIONS_COMMUNICATION.value,
    Module.PROFILE.value,
    Module.SETTINGS.value,
)

# Roles whose default templates can be edited in Role & Permissions UI
CONFIGURABLE_TEMPLATE_ROLES: tuple[str, ...] = ("salon_manager", "employee")

PERMISSION_REGISTRY: List[Dict[str, Any]] = [
    {"key": Module.DASHBOARD.value, "label": "Dashboard", "group": "Core"},
    {"key": Module.INVITE.value, "label": "Invite", "group": "Core"},
    {"key": Module.APPOINTMENTS.value, "label": "Appointments", "group": "Core"},
    {"key": Module.MY_EARNINGS.value, "label": "My Earnings", "group": "Core"},
    {"key": Module.ATTENDANCE.value, "label": "Attendance", "group": "Core"},
    {"key": Module.LEAVE.value, "label": "Leave", "group": "Core"},
    {"key": Module.PROFILE.value, "label": "Profile", "group": "Core"},
    {"key": Module.SETTINGS.value, "label": "Settings", "group": "Core"},
    {
        "key": Module.SALON_MANAGEMENT.value,
        "label": "Salon Management",
        "group": "Salon",
        "children": [
            {"key": Module.EMPLOYEES.value, "label": "Employees"},
            {"key": Module.SERVICES.value, "label": "Manage Salon"},
            {"key": Module.PRODUCTS_INVENTORY.value, "label": "Products & Inventory"},
        ],
    },
    {"key": Module.USER_MANAGEMENT.value, "label": "User Management", "group": "Admin"},
    {"key": Module.SUBSCRIPTION_MANAGEMENT.value, "label": "Subscription Management", "group": "Admin"},
    {
        "key": Module.BILLING_FINANCE.value,
        "label": "Billing & Finance",
        "group": "Finance",
        "children": [
            {"key": BILLING_BILLS, "label": "Bills"},
            {"key": BILLING_PAYROLL, "label": "Payroll"},
            {"key": BILLING_EXPENSES, "label": "Expenses"},
        ],
    },
    {"key": Module.CUSTOMER_ANALYTICS.value, "label": "Customer Analytics", "group": "Analytics"},
    {"key": Module.STAFF_MONITORING.value, "label": "Staff & HR Monitoring", "group": "Analytics"},
    {
        "key": Module.NOTIFICATIONS_COMMUNICATION.value,
        "label": "Notifications & Communication",
        "group": "Communication",
    },
]


def _module_to_permission_key(module: Module) -> str:
    return module.value


def default_permissions_for_role(role: Optional[str]) -> Dict[str, bool]:
    """Build default permission map from static ROLE_MODULE_ACCESS."""
    normalized = normalize_role(role)
    if not normalized:
        return {key: False for key in ALL_PERMISSION_KEYS}

    allowed_modules = ROLE_MODULE_ACCESS.get(normalized, frozenset())

    perms: Dict[str, bool] = {}
    for key in ALL_PERMISSION_KEYS:
        module_key = key
        if key in (BILLING_BILLS, BILLING_PAYROLL, BILLING_EXPENSES):
            module_key = Module.BILLING_FINANCE.value
        elif key not in {m.value for m in Module}:
            module_key = key
        else:
            module_key = key

        if key in (BILLING_BILLS, BILLING_PAYROLL, BILLING_EXPENSES):
            perms[key] = Module.BILLING_FINANCE in allowed_modules
        else:
            try:
                module = Module(key)
                perms[key] = module in allowed_modules
            except ValueError:
                perms[key] = False

    return perms


def merge_permission_layers(
    base: Dict[str, bool],
    role_overrides: Optional[Dict[str, bool]] = None,
    user_overrides: Optional[Dict[str, bool]] = None,
) -> Dict[str, bool]:
    """Merge permission layers: base → role template → user overrides."""
    merged = dict(base)
    if role_overrides:
        for key, value in role_overrides.items():
            if key in ALL_PERMISSION_KEYS:
                merged[key] = bool(value)
    if user_overrides:
        for key, value in user_overrides.items():
            if key in ALL_PERMISSION_KEYS:
                merged[key] = bool(value)
    return merged


def can_access_permission(
    role: Optional[str],
    permission_key: str,
    merged_permissions: Optional[Dict[str, bool]] = None,
) -> bool:
    """Check if role/user has access to a permission key."""
    if merged_permissions is not None:
        return bool(merged_permissions.get(permission_key, False))

    defaults = default_permissions_for_role(role)
    return bool(defaults.get(permission_key, False))


def module_to_primary_permission(module: Module) -> str:
    return _module_to_permission_key(module)
