"""Permission resolution: role defaults, tenant templates, and user overrides."""

from typing import Dict, Optional, Tuple

from app.auth.module_permission_registry import (
    ALL_PERMISSION_KEYS,
    CONFIGURABLE_TEMPLATE_ROLES,
    default_permissions_for_role,
    merge_permission_layers,
    PERMISSION_REGISTRY,
)
from app.auth.rbac_config import (
    ROLE_SALON_OWNER,
    ROLE_SUPER_ADMIN,
    normalize_role,
)
from app.core.exceptions import PermissionDeniedException, ResourceNotFoundException
from app.models.user import User
from app.models.user_permission import PermissionRecord


class PermissionService:
    async def _resolve_tenant_id(self, user: User) -> Optional[str]:
        from app.core import tenant_context

        ctx_tenant = tenant_context.get_tenant_id()
        if ctx_tenant and ctx_tenant != "system":
            return ctx_tenant
        if user.tenant_id and user.tenant_id != "system":
            return user.tenant_id
        return None

    async def _get_role_template(
        self, tenant_id: str, role: str
    ) -> Optional[PermissionRecord]:
        return await PermissionRecord.find_one(
            {
                "tenant_id": tenant_id,
                "role": role,
                "user_id": None,
                "is_deleted": False,
            }
        )

    async def _get_user_override(
        self, tenant_id: str, user_id: str
    ) -> Optional[PermissionRecord]:
        return await PermissionRecord.find_one(
            {
                "tenant_id": tenant_id,
                "user_id": user_id,
                "is_deleted": False,
            }
        )

    def _full_access_permissions(self) -> Dict[str, bool]:
        return {key: True for key in ALL_PERMISSION_KEYS}

    async def get_merged_permissions(self, user: User) -> Dict[str, bool]:
        normalized = normalize_role(user.role)
        if normalized in (ROLE_SUPER_ADMIN, ROLE_SALON_OWNER):
            return self._full_access_permissions()

        base = default_permissions_for_role(user.role)
        tenant_id = await self._resolve_tenant_id(user)
        role_overrides: Optional[Dict[str, bool]] = None
        user_overrides: Optional[Dict[str, bool]] = None

        if tenant_id and normalized:
            role_doc = await self._get_role_template(tenant_id, normalized)
            if role_doc:
                role_overrides = role_doc.permissions

        if tenant_id:
            user_doc = await self._get_user_override(tenant_id, str(user.id))
            if user_doc:
                user_overrides = user_doc.permissions

        return merge_permission_layers(base, role_overrides, user_overrides)

    async def get_role_permissions(
        self, actor: User, role: str
    ) -> Tuple[Dict[str, bool], Dict[str, bool], Dict[str, bool]]:
        """Return defaults, stored template overrides, and effective permissions for a role."""
        self._assert_can_manage(actor)
        normalized = normalize_role(role)
        if not normalized or normalized not in CONFIGURABLE_TEMPLATE_ROLES:
            raise PermissionDeniedException(
                detail=f"Role '{role}' permissions are not configurable"
            )

        defaults = default_permissions_for_role(normalized)
        tenant_id = await self._resolve_tenant_id(actor)
        stored: Dict[str, bool] = {}
        if tenant_id:
            doc = await self._get_role_template(tenant_id, normalized)
            if doc:
                stored = doc.permissions

        effective = merge_permission_layers(defaults, stored)
        return defaults, stored, effective

    async def update_role_permissions(
        self, actor: User, role: str, permissions: Dict[str, bool]
    ) -> Dict[str, bool]:
        self._assert_can_manage(actor)
        normalized = normalize_role(role)
        if not normalized or normalized not in CONFIGURABLE_TEMPLATE_ROLES:
            raise PermissionDeniedException(
                detail=f"Role '{role}' permissions are not configurable"
            )

        tenant_id = await self._resolve_tenant_id(actor)
        if not tenant_id:
            raise PermissionDeniedException(
                detail="Select a salon to manage role permissions"
            )

        filtered = {
            k: bool(v) for k, v in permissions.items() if k in ALL_PERMISSION_KEYS
        }

        doc = await self._get_role_template(tenant_id, normalized)
        if doc:
            doc.permissions = filtered
            await doc.save()
        else:
            doc = PermissionRecord(
                tenant_id=tenant_id,
                role=normalized,
                permissions=filtered,
            )
            await doc.insert()

        defaults = default_permissions_for_role(normalized)
        return merge_permission_layers(defaults, filtered)

    async def get_user_permissions(
        self, actor: User, user_id: str
    ) -> Tuple[Dict[str, bool], Dict[str, bool], Dict[str, bool]]:
        """Return role defaults, user overrides, and effective permissions."""
        self._assert_can_manage(actor)
        target = await User.get(user_id)
        if not target or target.is_deleted:
            raise ResourceNotFoundException(detail="User not found")

        tenant_id = await self._resolve_tenant_id(actor)
        if tenant_id and target.tenant_id != tenant_id:
            raise PermissionDeniedException(
                detail="You cannot manage permissions for users outside your salon"
            )

        normalized = normalize_role(target.role)
        if normalized in (ROLE_SUPER_ADMIN, ROLE_SALON_OWNER):
            full = self._full_access_permissions()
            return full, {}, full

        defaults = default_permissions_for_role(target.role)
        if tenant_id and normalized:
            role_doc = await self._get_role_template(tenant_id, normalized)
            if role_doc:
                defaults = merge_permission_layers(defaults, role_doc.permissions)

        stored: Dict[str, bool] = {}
        if tenant_id:
            doc = await self._get_user_override(tenant_id, user_id)
            if doc:
                stored = doc.permissions

        effective = merge_permission_layers(defaults, stored)
        return defaults, stored, effective

    async def update_user_permissions(
        self, actor: User, user_id: str, permissions: Dict[str, bool]
    ) -> Dict[str, bool]:
        self._assert_can_manage(actor)
        target = await User.get(user_id)
        if not target or target.is_deleted:
            raise ResourceNotFoundException(detail="User not found")

        tenant_id = await self._resolve_tenant_id(actor)
        if tenant_id and target.tenant_id != tenant_id:
            raise PermissionDeniedException(
                detail="You cannot manage permissions for users outside your salon"
            )

        normalized = normalize_role(target.role)
        if normalized in (ROLE_SUPER_ADMIN, ROLE_SALON_OWNER):
            raise PermissionDeniedException(
                detail="Owner and super admin permissions cannot be overridden"
            )

        if not tenant_id:
            raise PermissionDeniedException(
                detail="Select a salon to manage user permissions"
            )

        filtered = {
            k: bool(v) for k, v in permissions.items() if k in ALL_PERMISSION_KEYS
        }

        doc = await self._get_user_override(tenant_id, user_id)
        if doc:
            doc.permissions = filtered
            await doc.save()
        else:
            doc = PermissionRecord(
                tenant_id=tenant_id,
                user_id=user_id,
                permissions=filtered,
            )
            await doc.insert()

        defaults = default_permissions_for_role(target.role)
        role_doc = await self._get_role_template(tenant_id, normalized)
        if role_doc:
            defaults = merge_permission_layers(defaults, role_doc.permissions)
        return merge_permission_layers(defaults, filtered)

    def get_registry(self) -> list:
        return PERMISSION_REGISTRY

    def _assert_can_manage(self, actor: User) -> None:
        normalized = normalize_role(actor.role)
        if normalized not in (ROLE_SUPER_ADMIN, ROLE_SALON_OWNER):
            raise PermissionDeniedException(
                detail="Only salon owners and super admins can manage permissions"
            )
