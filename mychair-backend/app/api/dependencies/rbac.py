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


MODULE_FEATURE_MAP: Dict[Module, str] = {
    Module.DASHBOARD: "DASHBOARD",
    Module.INVITE: "INVITE",
    Module.APPOINTMENTS: "BILLING",
    Module.MY_EARNINGS: "MY_EARNINGS",
    Module.SALON_MANAGEMENT: "SALON_MANAGEMENT",
    Module.EMPLOYEES: "SALON_MANAGEMENT",
    Module.SERVICES: "SALON_MANAGEMENT",
    Module.USER_MANAGEMENT: "SALON_MANAGEMENT",
    Module.ROLES_PERMISSIONS: "ROLE_PERMISSIONS",
    Module.BILLING_FINANCE: "BILLING_FINANCE",
    Module.PRODUCTS_INVENTORY: "SALON_MANAGEMENT",
    Module.STAFF_MONITORING: "ATTENDANCE",
    Module.ATTENDANCE: "ATTENDANCE",
    Module.LEAVE: "LEAVE",
    Module.CUSTOMER_ANALYTICS: "CUSTOMER_ANALYTICS",
    Module.NOTIFICATIONS_COMMUNICATION: "NOTIFICATIONS",
    Module.PROFILE: "PROFILE",
    Module.SETTINGS: "SALON_MANAGEMENT",
}


def require_feature(feature_key: str) -> Callable:
    """Dependency factory: current user's salon plan must include the specified feature."""

    async def _checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        normalized_role = normalize_role(current_user.role)
        if normalized_role != ROLE_SUPER_ADMIN and current_user.tenant_id:
            from app.services.plan_service import PlanService

            plan_service = PlanService()
            enabled = await plan_service.is_feature_enabled_for_tenant(
                current_user.tenant_id, feature_key
            )
            if not enabled:
                raise PermissionDeniedException(
                    detail=f"The feature '{feature_key}' is not available in your salon's subscription plan."
                )
        return current_user

    return _checker


def require_module(module: Module) -> Callable:
    """Dependency factory: current user must pass Layer 1 (Plan Feature) AND Layer 2 (RBAC Permission)."""

    async def _checker(
        current_user: User = Depends(get_current_user),
        merged_permissions: Dict[str, bool] = Depends(get_merged_permissions),
    ) -> User:
        normalized_role = normalize_role(current_user.role)

        # Layer 1: Subscription Feature check (Super Admin exempt)
        if normalized_role != ROLE_SUPER_ADMIN and current_user.tenant_id:
            feature_key = MODULE_FEATURE_MAP.get(module)
            if feature_key and module != Module.SUBSCRIPTION_MANAGEMENT:
                from app.services.plan_service import PlanService

                plan_service = PlanService()
                enabled = await plan_service.is_feature_enabled_for_tenant(
                    current_user.tenant_id, feature_key
                )
                if not enabled:
                    raise PermissionDeniedException(
                        detail=f"The feature '{feature_key}' is not available in your salon's subscription plan."
                    )

        # Layer 2: User RBAC check
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
        normalized_role = normalize_role(current_user.role)
        if normalized_role != ROLE_SUPER_ADMIN and current_user.tenant_id:
            from app.services.plan_service import PlanService

            plan_service = PlanService()
            # Verify if at least one requested module is enabled in tenant plan
            has_enabled_plan_feature = False
            for mod in modules:
                feat = MODULE_FEATURE_MAP.get(mod)
                if not feat or await plan_service.is_feature_enabled_for_tenant(
                    current_user.tenant_id, feat
                ):
                    has_enabled_plan_feature = True
                    break
            if not has_enabled_plan_feature:
                raise PermissionDeniedException(
                    detail="Requested features are not available in your salon's subscription plan."
                )

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
