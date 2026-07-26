from typing import Dict, List, Optional, Set
import logging

from beanie import PydanticObjectId

from app.auth.rbac import can_manage_user
from app.auth.rbac_config import (
    EMPLOYEE_TABLE_ROLES,
    ROLE_SUPER_ADMIN,
    ROLE_SALON_MANAGER,
    ROLE_EMPLOYEE,
    employee_list_roles_visible,
    normalize_role,
)
from app.core.exceptions import ImmutableResourceException, PermissionDeniedException
from app.core.security import get_password_hash
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.employee import EmployeeListItem, EmployeeUpdate, SalonEmployeeGroup
from app.utils.user_name import user_display_name


class EmployeeService:
    def __init__(self) -> None:
        self.repo = UserRepository()
        self.logger = logging.getLogger(__name__)

    @staticmethod
    def _to_list_item(
        user: User, created_by_name: Optional[str] = None
    ) -> EmployeeListItem:
        return EmployeeListItem(
            id=str(user.id),
            full_name=user_display_name(user),
            first_name=user.first_name,
            last_name=user.last_name,
            role=user.role,
            email=user.email,
            phone=user.phone,
            branch_name=user.branch_name,
            salon_id=user.tenant_id,
            status=user.status,
            is_active=user.is_active,
            created_at=user.created_at,
            created_by=user.created_by,
            created_by_name=created_by_name,
            weekly_off=user.weekly_off or [],
        )

    async def _creator_names_by_id(self, users: List[User]) -> Dict[str, str]:
        creator_ids: Set[str] = {
            str(u.created_by) for u in users if u.created_by
        }
        if not creator_ids:
            return {}

        object_ids: List[PydanticObjectId] = []
        for creator_id in creator_ids:
            try:
                object_ids.append(PydanticObjectId(creator_id))
            except Exception:
                continue

        if not object_ids:
            return {}

        # Include soft-deleted creators so historical "Created by" still shows a name
        creators = await User.find({"_id": {"$in": object_ids}}).to_list()
        return {
            str(creator.id): user_display_name(creator)
            for creator in creators
        }

    async def _to_list_items(self, users: List[User]) -> List[EmployeeListItem]:
        creator_names = await self._creator_names_by_id(users)
        return [
            self._to_list_item(
                user,
                created_by_name=(
                    creator_names.get(str(user.created_by))
                    if user.created_by
                    else None
                ),
            )
            for user in users
        ]

    def _resolve_tenant_id(self, actor: User, tenant_id: Optional[str]) -> Optional[str]:
        normalized = normalize_role(actor.role)
        if normalized == ROLE_SUPER_ADMIN:
            return tenant_id
        if not actor.tenant_id:
            raise PermissionDeniedException(detail="No salon associated with your account")
        return actor.tenant_id

    async def list_employees(
        self,
        actor: User,
        tenant_id: Optional[str] = None,
        role: Optional[str] = None,
        search: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 100,
    ) -> List[EmployeeListItem]:
        visible_roles = employee_list_roles_visible(actor.role)
        if not visible_roles:
            raise PermissionDeniedException(
                detail="Your role is not permitted to view employees"
            )

        resolved_tenant = self._resolve_tenant_id(actor, tenant_id)
        roles = list(visible_roles)
        if role:
            role = role.strip()
            if role not in visible_roles:
                raise PermissionDeniedException(
                    detail=f"Role '{role}' is not available in employee listings"
                )
            roles = [role]

        if resolved_tenant:
            users = await self.repo.list_employees(
                tenant_id=resolved_tenant,
                roles=roles,
                search=search,
                status=status,
                page=page,
                limit=limit,
            )
        else:
            users = await self.repo.list_employees_all_tenants(
                roles=roles,
                search=search,
                status=status,
                page=page,
                limit=limit,
            )
        safe_users = [u for u in (users or []) if u]
        if len(safe_users) != len(users or []):
            self.logger.warning("Filtered null employee records from repository result")
        return await self._to_list_items(safe_users)

    async def list_employees_by_salon(
        self,
        actor: User,
        tenant_id: Optional[str] = None,
        search: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[SalonEmployeeGroup]:
        """Return employees grouped by salon/branch — managers and staff separately."""
        visible_roles = employee_list_roles_visible(actor.role)
        if not visible_roles:
            raise PermissionDeniedException(
                detail="Your role is not permitted to view employees"
            )

        resolved_tenant = self._resolve_tenant_id(actor, tenant_id)
        roles = [ROLE_SALON_MANAGER, ROLE_EMPLOYEE]
        # Restrict to visible roles only
        roles = [r for r in roles if r in visible_roles]

        if resolved_tenant:
            users = await self.repo.list_employees(
                tenant_id=resolved_tenant,
                roles=roles,
                search=search,
                status=status,
                page=1,
                limit=1000,
            )
        else:
            users = await self.repo.list_employees_all_tenants(
                roles=roles,
                search=search,
                status=status,
                page=1,
                limit=1000,
            )

        safe_users = [u for u in (users or []) if u]
        items_by_id = {
            item.id: item for item in await self._to_list_items(safe_users)
        }

        # Group by (tenant_id, branch_name)
        groups: Dict[str, SalonEmployeeGroup] = {}
        for u in safe_users:
            key = f"{u.tenant_id or 'unknown'}::{u.branch_name or ''}"
            if key not in groups:
                groups[key] = SalonEmployeeGroup(
                    salon_id=u.tenant_id or "unknown",
                    salon_name=None,
                    branch_name=u.branch_name,
                )
            item = items_by_id[str(u.id)]
            if u.role == ROLE_SALON_MANAGER:
                groups[key].managers.append(item)
            else:
                groups[key].staff.append(item)

        return list(groups.values())

    async def _get_employee_in_scope(self, actor: User, user_id: str) -> User:
        visible_roles = employee_list_roles_visible(actor.role)
        if not visible_roles:
            raise PermissionDeniedException(
                detail="Your role is not permitted to manage employees"
            )

        user = await self.repo.get(user_id)
        if user.role not in EMPLOYEE_TABLE_ROLES:
            raise PermissionDeniedException(detail="User is not an employee record")

        normalized = normalize_role(actor.role)
        if normalized == ROLE_SUPER_ADMIN:
            return user
        if user.tenant_id != actor.tenant_id:
            raise PermissionDeniedException(detail="Cross-tenant access denied")

        return user

    async def get_employee(self, actor: User, user_id: str) -> EmployeeListItem:
        user = await self._get_employee_in_scope(actor, user_id)
        items = await self._to_list_items([user])
        return items[0]

    async def update_employee(
        self, actor: User, user_id: str, payload: EmployeeUpdate
    ) -> EmployeeListItem:
        target = await self._get_employee_in_scope(actor, user_id)
        if not can_manage_user(actor.role, target.role, "update"):
            raise PermissionDeniedException(
                detail=f"Cannot update user with role '{target.role}'"
            )

        update_data = {"updated_by": str(actor.id)}
        if payload.first_name is not None:
            update_data["first_name"] = payload.first_name
        if payload.last_name is not None:
            update_data["last_name"] = payload.last_name
        if payload.email is not None:
            normalized_email = str(payload.email).strip().lower()
            existing = await self.repo.get_by_email_global_excluding_user(
                normalized_email, user_id
            )
            if existing:
                raise ImmutableResourceException(
                    detail="This email is already registered"
                )
            update_data["email"] = normalized_email
        if payload.phone is not None:
            update_data["phone"] = payload.phone
        if payload.branch_name is not None:
            update_data["branch_name"] = payload.branch_name
        if payload.role is not None:
            update_data["role"] = payload.role
        if payload.is_active is not None:
            update_data["is_active"] = payload.is_active
            update_data["status"] = "ACTIVE" if payload.is_active else "INACTIVE"
        if payload.weekly_off is not None:
            update_data["weekly_off"] = payload.weekly_off

        updated = await self.repo.update_fields(
            user_id, target.tenant_id, update_data
        )
        items = await self._to_list_items([updated])
        return items[0]

    async def set_employee_status(
        self, actor: User, user_id: str, is_active: bool
    ) -> EmployeeListItem:
        return await self.update_employee(
            actor,
            user_id,
            EmployeeUpdate(is_active=is_active),
        )

    async def reset_password(
        self, actor: User, user_id: str, password: str, confirm_password: str
    ) -> dict:
        if not password or len(password) < 8:
            raise ImmutableResourceException(
                detail="Password must be at least 8 characters"
            )
        if password != confirm_password:
            raise ImmutableResourceException(detail="Passwords do not match")

        target = await self._get_employee_in_scope(actor, user_id)
        if not can_manage_user(actor.role, target.role, "update"):
            raise PermissionDeniedException(
                detail=f"Cannot reset password for role '{target.role}'"
            )

        current_version = target.refresh_token_version or 0
        await self.repo.update_fields(
            user_id,
            target.tenant_id,
            {
                "hashed_password": get_password_hash(password),
                "refresh_token_version": current_version + 1,
                "updated_by": str(actor.id),
            },
        )
        return {"id": user_id, "email": target.email}
