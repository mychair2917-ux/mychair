import re
from typing import Optional, Tuple

from app.core.security import create_access_token, create_refresh_token, verify_password
from app.models.user import User
from app.services.permission_service import PermissionService
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

        permissions = await PermissionService().get_merged_permissions(user)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "role": user.role,
            "tenant_id": tenant_id,
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
