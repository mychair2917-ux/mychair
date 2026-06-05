from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import EmailStr
from app.models.user import User
from app.repositories.base import BaseRepository
from app.utils.timezone import now_utc


class UserRepository(BaseRepository[User]):
    def __init__(self) -> None:
        super().__init__(User)

    async def get_by_email(
        self,
        email: EmailStr | str,
        tenant_id: Optional[str] = None,
    ) -> Optional[User]:
        query: Dict[str, Any] = {"email": email, "is_deleted": False}
        if tenant_id:
            query["tenant_id"] = tenant_id
        return await User.find_one(query)

    async def get_by_email_global(self, email: EmailStr | str) -> Optional[User]:
        return await User.find_one({"email": email, "is_deleted": False})

    async def get_by_email_excluding_user(
        self,
        email: EmailStr | str,
        user_id: str,
        tenant_id: Optional[str] = None,
    ) -> Optional[User]:
        query: Dict[str, Any] = {
            "email": email,
            "is_deleted": False,
            "_id": {"$ne": self._to_object_id(user_id)},
        }
        if tenant_id:
            query["tenant_id"] = tenant_id
        return await User.find_one(query)

    async def get_by_email_global_excluding_user(
        self,
        email: EmailStr | str,
        user_id: str,
    ) -> Optional[User]:
        query: Dict[str, Any] = {
            "email": email,
            "is_deleted": False,
            "_id": {"$ne": self._to_object_id(user_id)},
        }
        return await User.find_one(query)

    async def list_by_tenant(self, tenant_id: str) -> List[User]:
        return await User.find(
            {"tenant_id": tenant_id, "is_deleted": False}
        ).to_list()

    async def create_user(self, user: User) -> User:
        await user.insert()
        return user

    async def list_employees(
        self,
        tenant_id: str,
        roles: List[str],
        search: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 100,
    ) -> List[User]:
        query: Dict[str, Any] = {
            "tenant_id": tenant_id,
            "role": {"$in": roles},
            "is_deleted": False,
        }
        if status:
            query["status"] = status.strip().upper()
        if search and search.strip():
            term = search.strip()
            query["$or"] = [
                {"first_name": {"$regex": term, "$options": "i"}},
                {"last_name": {"$regex": term, "$options": "i"}},
                {"email": {"$regex": term, "$options": "i"}},
                {"phone": {"$regex": term, "$options": "i"}},
            ]
        skip = max(0, (page - 1) * limit)
        return await User.find(query).sort("-created_at").skip(skip).limit(limit).to_list()

    async def list_employees_all_tenants(
        self,
        roles: List[str],
        search: Optional[str] = None,
        status: Optional[str] = None,
        page: int = 1,
        limit: int = 100,
    ) -> List[User]:
        query: Dict[str, Any] = {
            "role": {"$in": roles},
            "is_deleted": False,
        }
        if status:
            query["status"] = status.strip().upper()
        if search and search.strip():
            term = search.strip()
            query["$or"] = [
                {"first_name": {"$regex": term, "$options": "i"}},
                {"last_name": {"$regex": term, "$options": "i"}},
                {"email": {"$regex": term, "$options": "i"}},
                {"phone": {"$regex": term, "$options": "i"}},
            ]
        skip = max(0, (page - 1) * limit)
        return await User.find(query).sort("-created_at").skip(skip).limit(limit).to_list()

    async def update_fields(
        self,
        user_id: str,
        tenant_id: str,
        data: Dict[str, Any],
    ) -> User:
        user = await self.get(user_id)
        if user.tenant_id != tenant_id:
            from app.core.exceptions import TenantAccessDeniedException
            raise TenantAccessDeniedException()
        for field, value in data.items():
            setattr(user, field, value)
        await user.save()
        return user

    async def soft_delete_user(self, user_id: str, tenant_id: str) -> User:
        user = await self.get(user_id)
        if user.tenant_id != tenant_id:
            from app.core.exceptions import TenantAccessDeniedException
            raise TenantAccessDeniedException()
        user.is_deleted = True
        user.deleted_at = now_utc()
        await user.save()
        return user

    @staticmethod
    def _to_object_id(user_id: str):
        from beanie import PydanticObjectId

        return PydanticObjectId(user_id)
