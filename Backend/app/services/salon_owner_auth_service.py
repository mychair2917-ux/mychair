from typing import Optional, Tuple

from app.core.security import verify_password, create_access_token, create_refresh_token
from app.models.owner_salon import OwnerSalon
from app.models.user import User
from app.utils.timezone import now_utc


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
        salon_id = user.tenant_id or ""

        salon = await OwnerSalon.get(salon_id) if salon_id else None
        username = salon.username if salon else ""

        access_token = create_access_token(
            subject=user_id,
            tenant_id=salon_id,
            role=self.SALON_OWNER_ROLE,
        )
        refresh_token = create_refresh_token(
            subject=user_id,
            tenant_id=salon_id,
            role=self.SALON_OWNER_ROLE,
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "role": user.role,
            "salon_id": salon_id,
            "email": user.email,
            "username": username,
        }, None

    async def get_profile(self, owner_id: str) -> Tuple[Optional[dict], Optional[str]]:
        user = await User.get(owner_id)
        if not user:
            return None, "Salon owner not found"

        if not user.tenant_id:
            return None, "No salon associated with this account"

        salon = await OwnerSalon.get(user.tenant_id)
        if not salon:
            return None, "Salon not found"

        return {
            "salon_name": salon.salon_name,
            "slug": salon.slug,
            "email": salon.email,
            "username": salon.username,
            "address": salon.address,
        }, None
