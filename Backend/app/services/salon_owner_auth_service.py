from typing import Optional, Tuple

from app.core.security import verify_password, create_access_token, create_refresh_token
from app.models.tenant import Tenant
from app.models.user import User
from app.services.permission_service import PermissionService
from app.utils.timezone import now_utc


def _full_name_from_user(user: User) -> str:
    if user.first_name and user.last_name:
        return f"{user.first_name} {user.last_name}".strip()
    return (user.first_name or user.last_name or "").strip()


class SalonOwnerAuthService:
    """Authentication and profile logic for salon owners."""

    SALON_OWNER_ROLE = "salon_owner"

    async def login(self, email: str, password: str) -> Tuple[Optional[dict], Optional[str]]:
        user = await User.find_one(
            User.email == email,
            User.role == self.SALON_OWNER_ROLE,
            User.is_deleted == False,
        )
        if not user:
            return None, "Invalid email or password"

        if not verify_password(password, user.hashed_password):
            return None, "Invalid email or password"

        if not user.is_active or user.status != "ACTIVE":
            return None, "Account is not active. Please accept your invitation first."

        user.last_login = now_utc()
        await user.save()

        user_id = str(user.id)
        tenant_id = user.tenant_id or ""

        access_token = create_access_token(
            subject=user_id,
            tenant_id=tenant_id,
            role=self.SALON_OWNER_ROLE,
        )
        refresh_token = create_refresh_token(
            subject=user_id,
            tenant_id=tenant_id,
            role=self.SALON_OWNER_ROLE,
            token_version=user.refresh_token_version or 0,
        )

        permissions = await PermissionService().get_merged_permissions(user)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "role": user.role,
            "salon_id": tenant_id,
            "email": user.email,
            "id": user_id,
            "username": user.username or "",
            "first_name": user.first_name or "",
            "last_name": user.last_name or "",
            "phone": user.phone or "",
            "alternate_phone": user.alternate_phone or "",
            "avatar": user.avatar,
            "employee_id": user.employee_id or "",
            "employee_code": user.employee_code or "",
            "branch_name": user.branch_name or "",
            "branch_id": user.branch_id or "",
            "salon_name": user.salon_name or "",
            "department": user.department or "",
            "designation": user.designation or "",
            "status": user.status,
            "joining_date": user.joining_date.isoformat() if user.joining_date else None,
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "permissions": permissions,
        }, None

    async def get_profile(self, owner_id: str) -> Tuple[Optional[dict], Optional[str]]:
        user = await User.get(owner_id)
        if not user or user.role != self.SALON_OWNER_ROLE:
            return None, "Salon owner not found"

        if not user.tenant_id:
            return None, "No salon associated with this account"

        tenant = await Tenant.get(user.tenant_id)
        slug = tenant.slug if tenant else ""

        return {
            "salon_name": user.salon_name or (tenant.name if tenant else ""),
            "slug": slug,
            "email": user.email,
            "username": user.username or "",
            "owner_full_name": _full_name_from_user(user),
            "owner_phone_number": user.phone or "",
            "salon_phone_number": user.salon_phone_number or "",
            "salon_type": user.salon_type or "",
            "branch_name": user.branch_name or "",
            "subscription_plan": user.subscription_plan or "",
            "address": user.address or "",
        }, None
