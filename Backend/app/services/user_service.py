from typing import Any, Dict, List, Optional
from app.auth.rbac import (
    can_create_role,
    can_manage_user,
    require_user_permission,
    assert_valid_role,
)
from app.core.exceptions import PermissionDeniedException
from app.core.security import get_password_hash
from app.models.permissions import Permission
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate, UserUpdate
from app.core import tenant_context


class UserService:
    def __init__(self) -> None:
        self.repo = UserRepository()

    def _to_response(self, user: User) -> Dict[str, Any]:
        return {
            "id": str(user.id),
            "email": user.email,
            "phone": user.phone,
            "role": user.role,
            "permissions": user.permissions,
            "is_active": user.is_active,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "employee_id": user.employee_id,
            "tenant_id": user.tenant_id,
        }

    async def create_user(self, payload: UserCreate, actor: User) -> User:
        require_user_permission(actor.role, Permission.CREATE_USER.value)
        assert_valid_role(payload.role)

        if not can_create_role(actor.role, payload.role):
            raise PermissionDeniedException(
                detail=f"Role '{actor.role}' cannot create users with role '{payload.role}'"
            )

        tenant_id = actor.tenant_id
        if actor.role == "super_admin" and tenant_context.get_tenant_id():
            tenant_id = tenant_context.get_tenant_id() or actor.tenant_id

        existing = await self.repo.get_by_email(payload.email, tenant_id=tenant_id)
        if existing:
            raise PermissionDeniedException(detail="Email already registered in this tenant")

        user = User(
            email=payload.email,
            phone=payload.phone,
            hashed_password=get_password_hash(payload.password),
            role=payload.role,
            permissions=payload.permissions,
            first_name=payload.first_name,
            last_name=payload.last_name,
            employee_id=payload.employee_id,
            tenant_id=tenant_id,
            created_by=str(actor.id),
            is_active=True,
        )
        return await self.repo.create_user(user)

    async def list_users(self, actor: User) -> List[User]:
        require_user_permission(actor.role, Permission.LIST_USERS.value)
        if not can_manage_user(actor.role, "employee", "list"):
            raise PermissionDeniedException(detail="Not authorized to list users")
        return await self.repo.list_by_tenant(actor.tenant_id)

    async def get_user(self, user_id: str, actor: User) -> User:
        require_user_permission(actor.role, Permission.LIST_USERS.value)
        user = await self.repo.get(user_id)
        if actor.role != "super_admin" and user.tenant_id != actor.tenant_id:
            raise PermissionDeniedException(detail="Cross-tenant access denied")
        return user

    async def update_user(self, user_id: str, payload: UserUpdate, actor: User) -> User:
        require_user_permission(actor.role, Permission.UPDATE_USER.value)
        target = await self.repo.get(user_id)

        if actor.role != "super_admin" and target.tenant_id != actor.tenant_id:
            raise PermissionDeniedException(detail="Cross-tenant access denied")

        if str(target.id) == str(actor.id) and payload.role and payload.role != actor.role:
            raise PermissionDeniedException(detail="Cannot change your own role")

        if payload.role:
            assert_valid_role(payload.role)
            if not can_manage_user(actor.role, target.role, "update"):
                raise PermissionDeniedException(
                    detail=f"Cannot update user with role '{target.role}'"
                )
            if not can_create_role(actor.role, payload.role):
                raise PermissionDeniedException(
                    detail=f"Cannot assign role '{payload.role}'"
                )

        update_data: Dict[str, Any] = {"updated_by": str(actor.id)}
        if payload.email is not None:
            update_data["email"] = payload.email
        if payload.phone is not None:
            update_data["phone"] = payload.phone
        if payload.password is not None:
            update_data["hashed_password"] = get_password_hash(payload.password)
        if payload.role is not None:
            update_data["role"] = payload.role
        if payload.permissions is not None:
            update_data["permissions"] = payload.permissions
        if payload.is_active is not None:
            update_data["is_active"] = payload.is_active
        if payload.first_name is not None:
            update_data["first_name"] = payload.first_name
        if payload.last_name is not None:
            update_data["last_name"] = payload.last_name
        if payload.employee_id is not None:
            update_data["employee_id"] = payload.employee_id

        return await self.repo.update_fields(user_id, target.tenant_id, update_data)

    async def delete_user(self, user_id: str, actor: User) -> None:
        require_user_permission(actor.role, Permission.DELETE_USER.value)
        if not can_manage_user(actor.role, "employee", "delete"):
            raise PermissionDeniedException(detail="Not authorized to delete users")

        target = await self.repo.get(user_id)
        if actor.role != "super_admin" and target.tenant_id != actor.tenant_id:
            raise PermissionDeniedException(detail="Cross-tenant access denied")
        if str(target.id) == str(actor.id):
            raise PermissionDeniedException(detail="Cannot delete your own account")

        if actor.role == "salon_admin" and target.role not in ("salon_manager", "employee"):
            raise PermissionDeniedException(
                detail=f"Cannot delete user with role '{target.role}'"
            )

        await self.repo.soft_delete_user(user_id, target.tenant_id)
