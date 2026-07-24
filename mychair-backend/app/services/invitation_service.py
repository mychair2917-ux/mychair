import re
import secrets
from datetime import timedelta
from typing import Optional, Tuple

from app.constants.invitation_options import (
    SALON_TYPES,
    VALID_SALON_TYPE_VALUES,
)
from app.constants.subscription_options import (
    SUBSCRIPTION_PLANS,
    VALID_SUBSCRIPTION_PLAN_VALUES,
    normalize_plan_name,
)
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.invitation_token import InvitationToken
from app.models.subscription import Subscription
from app.models.salon import Salon
from app.models.tenant import Tenant
from app.models.user import User
from app.services.email_service import send_invitation_email
from app.services.subscription_service import SubscriptionService
from app.utils.timezone import now_utc, make_aware


class InvitationService:
    """Business logic for salon owner invitation lifecycle."""

    SALON_OWNER_ROLE = "salon_owner"

    def __init__(self) -> None:
        self._subscription_service = SubscriptionService()

    @staticmethod
    def get_form_options() -> dict:
        return {
            "salon_types": SALON_TYPES,
            "subscription_plans": SUBSCRIPTION_PLANS,
        }

    @staticmethod
    def _generate_token() -> str:
        return secrets.token_urlsafe(48)

    @staticmethod
    def _slugify(name: str) -> str:
        slug = name.lower().strip()
        slug = re.sub(r"[^a-z0-9]+", "-", slug)
        slug = re.sub(r"-+", "-", slug).strip("-")
        return slug[:100] or "salon"

    @staticmethod
    def _normalize_salon_name(name: str) -> str:
        return " ".join((name or "").strip().split()).casefold()

    async def _salon_name_exists(self, salon_name: str) -> bool:
        normalized_input = self._normalize_salon_name(salon_name)
        if not normalized_input:
            return False
        tenants = await Tenant.find({"is_deleted": False}).to_list()
        for tenant in tenants:
            if self._normalize_salon_name(tenant.name) == normalized_input:
                return True
        return False

    @staticmethod
    def _generate_username(owner_full_name: str, email: str) -> str:
        from_name = re.sub(r"[^a-z0-9_]", "", owner_full_name.lower().replace(" ", "_"))
        if len(from_name) >= 3:
            return from_name[:100]
        email_prefix = email.split("@")[0]
        cleaned = re.sub(r"[^a-z0-9_]", "", email_prefix.lower())
        return (cleaned or "salon_owner")[:100]

    @staticmethod
    def _split_full_name(full_name: str) -> Tuple[str, str]:
        parts = full_name.strip().split(maxsplit=1)
        if not parts:
            return "", ""
        if len(parts) == 1:
            return parts[0], ""
        return parts[0], parts[1]

    @staticmethod
    def _full_name_from_user(user: User) -> str:
        if user.first_name and user.last_name:
            return f"{user.first_name} {user.last_name}".strip()
        return (user.first_name or user.last_name or "").strip()

    async def _ensure_unique_slug(self, base_slug: str) -> str:
        slug = base_slug
        counter = 1
        while await Tenant.find_one(Tenant.slug == slug, Tenant.is_deleted == False):
            slug = f"{base_slug}-{counter}"[:100]
            counter += 1
        return slug

    async def _ensure_unique_username(self, base_username: str) -> str:
        username = base_username
        counter = 1
        while await User.find_one(
            User.username == username,
            User.role == self.SALON_OWNER_ROLE,
            User.is_deleted == False,
        ):
            username = f"{base_username}{counter}"[:100]
            counter += 1
        return username

    @staticmethod
    def _pending_invitation_query(email: str) -> dict:
        return {
            "email": email,
            "role": InvitationService.SALON_OWNER_ROLE,
            "status": "INACTIVE",
            "is_active": False,
            "is_deleted": False,
        }

    async def _delete_tenant_workspace(self, tenant_id: str, owner_id: str) -> None:
        if owner_id:
            await InvitationToken.find(InvitationToken.owner_id == owner_id).delete()
        else:
            await InvitationToken.find(InvitationToken.salon_id == tenant_id).delete()
        await Subscription.find(Subscription.tenant_id == tenant_id).delete()
        tenant = await Tenant.get(tenant_id)
        if tenant:
            await tenant.delete()

    async def _cleanup_stale_invitation(self, email: str, slug: str) -> None:
        """Remove incomplete invitations so a failed email send can be retried."""
        owner = await User.find_one(self._pending_invitation_query(email))
        if owner:
            if owner.tenant_id:
                tenant = await Tenant.get(owner.tenant_id)
                if tenant and tenant.slug == slug:
                    await self._delete_tenant_workspace(owner.tenant_id, str(owner.id))
            await owner.delete()

        stale_tenant = await Tenant.find_one(
            Tenant.slug == slug,
            Tenant.owner_email == email,
            Tenant.is_deleted == False,
        )
        if stale_tenant:
            stale_owner = await User.find_one(
                User.email == email,
                User.role == self.SALON_OWNER_ROLE,
                User.tenant_id == str(stale_tenant.id),
            )
            if stale_owner:
                await self._delete_tenant_workspace(str(stale_tenant.id), str(stale_owner.id))
                await stale_owner.delete()
            else:
                await self._delete_tenant_workspace(str(stale_tenant.id), "")
                await stale_tenant.delete()

    async def _check_duplicates(self, email: str, slug: str, username: str) -> Optional[dict]:
        errors: dict = {}
        if await User.find_one({"email": email, "is_deleted": False}):
            errors["email"] = ["This email is already registered"]
        if await Tenant.find_one(Tenant.slug == slug, Tenant.is_deleted == False):
            errors["slug"] = ["This salon identifier is already in use"]
        if await User.find_one(
            User.username == username,
            User.role == self.SALON_OWNER_ROLE,
            User.is_deleted == False,
        ):
            errors["username"] = ["This username is already taken"]
        return errors if errors else None

    async def create_invitation(
        self,
        salon_name: str,
        owner_full_name: str,
        email: str,
        salon_type: str,
        subscription_plan: str,
        owner_phone_number: str = "",
        salon_phone_number: str = "",
        branch_name: str = "",
        address: str = "",
        slug: Optional[str] = None,
        username: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        attendance_radius: int = 100,
        shift_start: str = "09:00",
        inviter_name: str = "",
    ) -> Tuple[Optional[dict], Optional[dict]]:
        """
        Create tenant, salon owner user, token and send invitation email.
        All salon/owner profile data is stored on the User document.
        Returns (data, errors) — one will be None.
        """
        salon_name = " ".join((salon_name or "").strip().split())
        salon_type = salon_type.strip().lower()
        subscription_plan = normalize_plan_name(subscription_plan)

        field_errors: dict = {}
        preferred_email = (email or "").strip()
        if not preferred_email:
            field_errors["email"] = ["Preferred email is required"]
        if not salon_name:
            field_errors["salon_name"] = ["Salon name is required"]
        elif await self._salon_name_exists(salon_name):
            field_errors["salon_name"] = ["Salon name already exists"]
        if salon_type not in VALID_SALON_TYPE_VALUES:
            field_errors["salon_type"] = ["Please select a valid salon type"]
        if subscription_plan not in VALID_SUBSCRIPTION_PLAN_VALUES:
            field_errors["subscription_plan"] = ["Please select a valid subscription plan"]
        if latitude is None or longitude is None:
            field_errors["location"] = ["Salon location is required for attendance"]
        if field_errors:
            return None, field_errors

        base_slug = slug.strip() if slug else self._slugify(salon_name)
        resolved_slug = await self._ensure_unique_slug(base_slug)

        base_username = (
            username.strip()
            if username
            else self._generate_username(owner_full_name, preferred_email)
        )
        resolved_username = await self._ensure_unique_username(base_username)

        await self._cleanup_stale_invitation(preferred_email, resolved_slug)

        duplicate_errors = await self._check_duplicates(
            preferred_email, resolved_slug, resolved_username
        )
        if duplicate_errors:
            return None, duplicate_errors

        token_value = self._generate_token()
        invitation_link = f"{settings.FRONTEND_URL}/create-password?token={token_value}"
        expiry_hours = settings.INVITATION_TOKEN_EXPIRE_HOURS

        email_sent, email_error = await send_invitation_email(
            to_email=preferred_email,
            salon_name=salon_name,
            username=resolved_username,
            invitation_link=invitation_link,
            recipient_name=owner_full_name,
            inviter_name=inviter_name,
            expiry_hours=expiry_hours,
        )

        if not email_sent:
            return None, {
                "email": [email_error or "Failed to send invitation email. Please try again."]
            }

        first_name, last_name = self._split_full_name(owner_full_name)

        tenant = Tenant(
            name=salon_name,
            slug=resolved_slug,
            owner_email=preferred_email,
            subscription_plan=subscription_plan,
            subscription_tier=subscription_plan,
            subscription_status="ACTIVE",
            latitude=latitude,
            longitude=longitude,
            attendance_radius=attendance_radius,
            shift_start=shift_start or "09:00",
        )
        await tenant.insert()
        tenant_id = str(tenant.id)

        branch_label = branch_name.strip() if branch_name else salon_name
        salon_branch = Salon(
            tenant_id=tenant_id,
            name=branch_label,
            address={"text": address} if address else {},
            latitude=latitude,
            longitude=longitude,
            attendance_radius=attendance_radius,
        )
        await salon_branch.insert()

        owner = User(
            email=preferred_email,
            phone=owner_phone_number or None,
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            first_name=first_name,
            last_name=last_name,
            role=self.SALON_OWNER_ROLE,
            is_active=False,
            status="INACTIVE",
            tenant_id=tenant_id,
            username=resolved_username,
            salon_name=salon_name,
            salon_phone_number=salon_phone_number or None,
            salon_type=salon_type,
            branch_name=branch_name or None,
            subscription_plan=subscription_plan,
            address=address or None,
        )
        await owner.insert()
        owner_id = str(owner.id)

        expires_at = now_utc() + timedelta(hours=expiry_hours)
        invitation = InvitationToken(
            salon_id=tenant_id,
            owner_id=owner_id,
            token=token_value,
            expires_at=expires_at,
        )
        await invitation.insert()

        await self._subscription_service.create_for_salon(
            tenant_id=tenant_id,
            salon_id=str(salon_branch.id),
            plan_name=subscription_plan,
            created_by=owner_id,
        )

        return {
            "salon_id": tenant_id,
            "owner_id": owner_id,
            "salon_name": salon_name,
            "email": preferred_email,
            "invitation_sent": True,
            "invitation_link": invitation_link,
            "email_delivered_to": preferred_email,
        }, None

    async def validate_token(self, token: str) -> Tuple[Optional[dict], Optional[str]]:
        invitation = await InvitationToken.find_one(InvitationToken.token == token)
        if not invitation:
            return None, "Invalid invitation token"

        if invitation.is_used:
            return None, "This invitation has already been used"

        if make_aware(invitation.expires_at) < now_utc():
            return None, "Invitation token has expired"

        owner = await User.get(invitation.owner_id)
        if not owner or owner.role != self.SALON_OWNER_ROLE:
            return None, "Associated owner not found"

        return {
            "salon_name": owner.salon_name or "",
            "email": owner.email,
            "username": owner.username or "",
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

        if make_aware(invitation.expires_at) < now_utc():
            return None, {"token": ["Invitation token has expired"]}

        owner = await User.get(invitation.owner_id)
        if not owner:
            return None, {"token": ["Owner account not found"]}

        owner.hashed_password = get_password_hash(password)
        owner.is_active = True
        owner.status = "ACTIVE"
        await owner.save()

        invitation.is_used = True
        await invitation.save()

        return {"owner_id": str(owner.id), "email": owner.email}, None
