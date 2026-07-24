from typing import Optional, Tuple

from jose import JWTError, jwt

from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token
from app.models.user import User
from app.services.subscription_service import SubscriptionService
from app.utils.timezone import now_utc


class AuthRefreshService:
    SUBSCRIPTION_EXPIRED = "SUBSCRIPTION_EXPIRED"

    def __init__(self) -> None:
        self._subscription_service = SubscriptionService()

    async def refresh(self, refresh_token: str) -> Tuple[Optional[dict], Optional[str]]:
        if not refresh_token or not refresh_token.strip():
            return None, "Refresh token is required"

        try:
            claims = jwt.decode(
                refresh_token.strip(),
                settings.REFRESH_SECRET_KEY,
                algorithms=[settings.ALGORITHM],
            )
        except JWTError:
            return None, "Invalid or expired refresh token"

        user_id = claims.get("sub")
        if not user_id:
            return None, "Invalid refresh token"

        user = await User.get(user_id)
        if not user or user.is_deleted:
            return None, "User not found"

        token_version = claims.get("token_version", 0)
        if token_version != (user.refresh_token_version or 0):
            return None, "Refresh token has been revoked"

        if user.role != "super_admin" and (not user.is_active or user.status != "ACTIVE"):
            return None, "Account is not active"

        is_valid, error_code = await self._subscription_service.check_subscription_for_user(user)
        if not is_valid:
            return None, error_code or self.SUBSCRIPTION_EXPIRED

        tenant_id = user.tenant_id if user.tenant_id else "system"
        access_token = create_access_token(
            subject=str(user.id),
            tenant_id=tenant_id,
            role=user.role,
        )
        new_refresh_token = create_refresh_token(
            subject=str(user.id),
            tenant_id=tenant_id,
            role=user.role,
            token_version=user.refresh_token_version or 0,
        )

        user.last_login = now_utc()
        await user.save()

        return {
            "access_token": access_token,
            "refresh_token": new_refresh_token,
            "token_type": "bearer",
            "role": user.role,
            "tenant_id": tenant_id,
        }, None
