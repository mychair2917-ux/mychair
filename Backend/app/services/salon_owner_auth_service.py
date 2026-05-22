from typing import Optional, Tuple

from app.core.security import verify_password, create_access_token, create_refresh_token
from app.models.owner_salon import OwnerSalon
from app.models.salon_owner import SalonOwner
from app.utils.timezone import now_utc


class SalonOwnerAuthService:
    """Authentication and profile logic for salon owners."""

    async def login(self, email: str, password: str) -> Tuple[Optional[dict], Optional[str]]:
        owner = await SalonOwner.find_one(SalonOwner.email == email)
        if not owner:
            return None, "Invalid email or password"

        if not owner.password_hash or not verify_password(password, owner.password_hash):
            return None, "Invalid email or password"

        if not owner.is_active or not owner.invitation_accepted:
            return None, "Account is not active. Please accept your invitation first."

        owner.updated_at = now_utc()
        await owner.save()

        owner_id = str(owner.id)
        salon_id = owner.salon_id or ""

        access_token = create_access_token(
            subject=owner_id,
            tenant_id=salon_id,
            role="salon_owner",
        )
        refresh_token = create_refresh_token(
            subject=owner_id,
            tenant_id=salon_id,
            role="salon_owner",
        )

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "role": owner.role,
            "salon_id": salon_id,
            "email": owner.email,
            "username": owner.username,
        }, None

    async def get_profile(self, owner_id: str) -> Tuple[Optional[dict], Optional[str]]:
        owner = await SalonOwner.get(owner_id)
        if not owner:
            return None, "Salon owner not found"

        if not owner.salon_id:
            return None, "No salon associated with this account"

        salon = await OwnerSalon.get(owner.salon_id)
        if not salon:
            return None, "Salon not found"

        return {
            "salon_name": salon.salon_name,
            "slug": salon.slug,
            "email": salon.email,
            "username": salon.username,
            "address": salon.address,
        }, None
