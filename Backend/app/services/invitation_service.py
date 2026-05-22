import secrets
from datetime import timedelta
from typing import Optional, Tuple

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.invitation_token import InvitationToken
from app.models.owner_salon import OwnerSalon
from app.models.salon_owner import SalonOwner
from app.services.email_service import send_invitation_email
from app.utils.timezone import now_utc


class InvitationService:
    """Business logic for salon owner invitation lifecycle."""

    @staticmethod
    def _generate_token() -> str:
        return secrets.token_urlsafe(48)

    async def _cleanup_stale_invitation(self, email: str, slug: str) -> None:
        """Remove incomplete invitations so a failed email send can be retried."""
        owner = await SalonOwner.find_one(
            SalonOwner.email == email,
            SalonOwner.invitation_accepted == False,
        )
        if not owner:
            return

        if owner.salon_id:
            await InvitationToken.find(
                InvitationToken.owner_id == str(owner.id)
            ).delete()
            salon = await OwnerSalon.get(owner.salon_id)
            if salon and salon.slug == slug:
                await salon.delete()

        await owner.delete()

        stale_salon = await OwnerSalon.find_one(OwnerSalon.slug == slug, OwnerSalon.email == email)
        if stale_salon:
            await InvitationToken.find(InvitationToken.salon_id == str(stale_salon.id)).delete()
            await stale_salon.delete()

    async def _check_duplicates(self, email: str, slug: str, username: str) -> Optional[dict]:
        errors: dict = {}
        if await OwnerSalon.find_one(OwnerSalon.email == email):
            errors["email"] = ["Email already exists"]
        if await OwnerSalon.find_one(OwnerSalon.slug == slug):
            errors["slug"] = ["Slug already exists"]
        if await SalonOwner.find_one(SalonOwner.email == email):
            errors["email"] = ["Email already exists"]
        if await SalonOwner.find_one(SalonOwner.username == username):
            errors["username"] = ["Username already exists"]
        return errors if errors else None

    async def create_invitation(
        self,
        salon_name: str,
        slug: str,
        email: str,
        username: str,
        address: str,
    ) -> Tuple[Optional[dict], Optional[dict]]:
        """
        Create salon, owner, token and send invitation email.
        Email is sent before DB writes so failed sends do not block retries.
        Returns (data, errors) — one will be None.
        """
        await self._cleanup_stale_invitation(email, slug)

        duplicate_errors = await self._check_duplicates(email, slug, username)
        if duplicate_errors:
            return None, duplicate_errors

        token_value = self._generate_token()
        invitation_link = f"{settings.FRONTEND_URL}/create-password?token={token_value}"

        email_sent, email_error = await send_invitation_email(
            to_email=email,
            salon_name=salon_name,
            username=username,
            invitation_link=invitation_link,
        )

        if not email_sent:
            return None, {
                "email": [email_error or "Failed to send invitation email. Please try again."]
            }

        owner = SalonOwner(
            email=email,
            username=username,
            is_active=False,
            invitation_accepted=False,
        )
        await owner.insert()
        owner_id = str(owner.id)

        salon = OwnerSalon(
            salon_name=salon_name,
            slug=slug,
            email=email,
            username=username,
            address=address,
            owner_id=owner_id,
        )
        await salon.insert()
        salon_id = str(salon.id)

        owner.salon_id = salon_id
        owner.updated_at = now_utc()
        await owner.save()

        expires_at = now_utc() + timedelta(hours=settings.INVITATION_TOKEN_EXPIRE_HOURS)
        invitation = InvitationToken(
            salon_id=salon_id,
            owner_id=owner_id,
            token=token_value,
            expires_at=expires_at,
        )
        await invitation.insert()

        return {
            "salon_id": salon_id,
            "owner_id": owner_id,
            "salon_name": salon_name,
            "email": email,
            "invitation_sent": True,
            "invitation_link": invitation_link,
            "email_delivered_to": settings.RESEND_TEST_EMAIL
            if email.lower() != settings.RESEND_TEST_EMAIL.lower()
            and "resend.dev" in settings.EMAIL_FROM.lower()
            else email,
        }, None

    async def validate_token(self, token: str) -> Tuple[Optional[dict], Optional[str]]:
        invitation = await InvitationToken.find_one(InvitationToken.token == token)
        if not invitation:
            return None, "Invalid invitation token"

        if invitation.is_used:
            return None, "This invitation has already been used"

        if invitation.expires_at < now_utc():
            return None, "Invitation token has expired"

        salon = await OwnerSalon.get(invitation.salon_id)
        if not salon:
            return None, "Associated salon not found"

        owner = await SalonOwner.get(invitation.owner_id)
        if not owner:
            return None, "Associated owner not found"

        return {
            "salon_name": salon.salon_name,
            "email": salon.email,
            "username": salon.username,
            "expires_at": invitation.expires_at.isoformat(),
            "is_valid": True,
        }, None

    async def create_password(
        self,
        token: str,
        password: str,
        confirm_password: str,
    ) -> Tuple[Optional[dict], Optional[dict]]:
        if password != confirm_password:
            return None, {"confirm_password": ["Passwords do not match"]}

        invitation = await InvitationToken.find_one(InvitationToken.token == token)
        if not invitation:
            return None, {"token": ["Invalid invitation token"]}

        if invitation.is_used:
            return None, {"token": ["This invitation has already been used"]}

        if invitation.expires_at < now_utc():
            return None, {"token": ["Invitation token has expired"]}

        owner = await SalonOwner.get(invitation.owner_id)
        if not owner:
            return None, {"token": ["Owner account not found"]}

        owner.password_hash = get_password_hash(password)
        owner.is_active = True
        owner.invitation_accepted = True
        owner.updated_at = now_utc()
        await owner.save()

        invitation.is_used = True
        await invitation.save()

        return {"owner_id": str(owner.id), "email": owner.email}, None
