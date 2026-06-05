from typing import Optional, Tuple

from beanie.operators import In

from app.auth.invitation_rbac import ROLE_EMPLOYEE, ROLE_SALON_MANAGER
from app.core.security import create_access_token, create_refresh_token, verify_password
from app.models.user import User
from app.utils.timezone import now_utc

TEAM_ROLES = frozenset({ROLE_SALON_MANAGER, ROLE_EMPLOYEE})


class TeamAuthService:
    """Login for salon manager and staff (phone + password, no email required)."""

    async def login(self, phone: str, password: str) -> Tuple[Optional[dict], Optional[str]]:
        cleaned = phone.strip()
        if not cleaned:
            return None, "Phone number is required"

        user = await User.find_one(
            User.phone == cleaned,
            In(User.role, list(TEAM_ROLES)),
            User.is_deleted == False,
        )
        if not user:
            return None, "Invalid phone number or password"

        if not verify_password(password, user.hashed_password):
            return None, "Invalid phone number or password"

        if not user.is_active or user.status != "ACTIVE":
            return None, "Account is not active. Contact your salon administrator."

        user.last_login = now_utc()
        await user.save()

        user_id = str(user.id)
        tenant_id = user.tenant_id or ""

        access_token = create_access_token(
            subject=user_id,
            tenant_id=tenant_id,
            role=user.role,
        )
        refresh_token = create_refresh_token(
            subject=user_id,
            tenant_id=tenant_id,
            role=user.role,
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "role": user.role,
            "tenant_id": tenant_id,
            "phone": user.phone or "",
            "email": user.email,
            "id": user_id,
            "username": user.username or "",
            "first_name": user.first_name or "",
            "last_name": user.last_name or "",
        }, None
