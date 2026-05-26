import re
from typing import Optional, Tuple

from app.core.security import create_access_token, create_refresh_token, verify_password
from app.models.user import User
from app.utils.timezone import now_utc

EMAIL_LOGIN_ROLES = frozenset(
    {"super_admin", "salon_owner", "salon_admin", "salon_manager", "employee"}
)


class AuthLoginService:
    """Email + password login for platform and tenant users."""

    async def login(self, email: str, password: str) -> Tuple[Optional[dict], Optional[str]]:
        normalized_email = email.strip().lower()
        if not normalized_email or not password:
            return None, "Invalid email or password"

        candidates = await User.find(
            {"email": {"$regex": f"^{re.escape(normalized_email)}$", "$options": "i"}},
            User.is_deleted == False,
        ).to_list()

        if not candidates:
            return None, "Invalid email or password"

        matched = [
            user
            for user in candidates
            if verify_password(password, user.hashed_password)
        ]
        if not matched:
            return None, "Invalid email or password"

        if len(matched) > 1:
            matched.sort(
                key=lambda u: (
                    0 if u.role == "super_admin" else 1,
                    0 if u.is_active and u.status == "ACTIVE" else 1,
                )
            )

        user = matched[0]

        if user.role not in EMAIL_LOGIN_ROLES:
            return None, "This account cannot sign in with email. Use phone login instead."

        if user.role != "super_admin" and (not user.is_active or user.status != "ACTIVE"):
            return None, (
                "Account is not active. Complete your invitation or contact your salon administrator."
            )

        user.last_login = now_utc()
        await user.save()

        user_id = str(user.id)
        tenant_id = user.tenant_id if user.tenant_id else "system"

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
            "email": user.email,
        }, None
