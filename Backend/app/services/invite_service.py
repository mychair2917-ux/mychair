import re
import secrets
from datetime import timedelta
from typing import Any, Dict, List, Optional, Tuple

from app.auth.invitation_rbac import (
    ROLE_EMPLOYEE,
    ROLE_SALON_MANAGER,
    ROLE_SALON_OWNER,
    ROLES_REQUIRING_SALON_SETUP,
    ROLES_REQUIRING_TENANT,
    assert_can_invite_role,
    resolve_tenant_id_for_invite,
)
from app.constants.invitation_options import SALON_TYPES, SUBSCRIPTION_PLANS
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.invite import Invite
from app.models.invitation_token import InvitationToken
from app.models.tenant import Tenant
from app.models.user import User
from app.schemas.invitation import CreateInviteRequest
from app.services.email_service import send_invitation_email, send_team_invitation_email
from app.services.invitation_service import InvitationService
from app.utils.timezone import make_aware, now_utc

RESEND_MAX = 5
ROLE_LABELS = {
    ROLE_SALON_OWNER: "Salon Owner",
    ROLE_SALON_MANAGER: "Manager",
    ROLE_EMPLOYEE: "Staff",
}


class InviteService:
    def __init__(self) -> None:
        self._salon_owner_flow = InvitationService()

    @staticmethod
    def _generate_token() -> str:
        return secrets.token_urlsafe(48)

    @staticmethod
    def _split_full_name(full_name: str) -> Tuple[str, str]:
        parts = full_name.strip().split(maxsplit=1)
        if not parts:
            return "", ""
        if len(parts) == 1:
            return parts[0], ""
        return parts[0], parts[1]

    @staticmethod
    def _invitable_roles_for(actor_role: str) -> List[dict]:
        from app.auth.invitation_rbac import INVITABLE_ROLES

        order = [ROLE_SALON_OWNER, ROLE_SALON_MANAGER, ROLE_EMPLOYEE]
        allowed = INVITABLE_ROLES.get(actor_role, frozenset())
        return [
            {"value": role, "label": ROLE_LABELS.get(role, role.replace("_", " ").title())}
            for role in order
            if role in allowed
        ]

    async def get_form_options(self, actor: User) -> dict:
        options = {
            "invitable_roles": self._invitable_roles_for(actor.role),
            "salon_types": SALON_TYPES,
            "subscription_plans": SUBSCRIPTION_PLANS,
            "tenants": [],
            "branches": [],
            "managers": [],
        }
        tenant_id = actor.tenant_id
        if actor.role == "super_admin":
            tenants = await Tenant.find(Tenant.is_deleted == False).to_list()
            options["tenants"] = [
                {"value": str(t.id), "label": t.name}
                for t in tenants
            ]
        elif tenant_id:
            tenant = await Tenant.get(tenant_id)
            if tenant:
                options["tenants"] = [{"value": tenant_id, "label": tenant.name}]
            managers = await User.find(
                User.tenant_id == tenant_id,
                User.role == ROLE_SALON_MANAGER,
                User.is_deleted == False,
                User.is_active == True,
            ).to_list()
            options["managers"] = [
                {
                    "value": str(m.id),
                    "label": self._display_name(m),
                }
                for m in managers
            ]
            branch_names = set()
            if actor.branch_name:
                branch_names.add(actor.branch_name)
            for m in managers:
                if m.branch_name:
                    branch_names.add(m.branch_name)
            options["branches"] = [
                {"value": name, "label": name} for name in sorted(branch_names)
            ]
        return options

    @staticmethod
    def _display_name(user: User) -> str:
        if user.first_name or user.last_name:
            return f"{user.first_name or ''} {user.last_name or ''}".strip()
        return user.email

    async def _pending_invite_for_email(self, email: str) -> Optional[Invite]:
        return await Invite.find_one(
            Invite.invited_email == email,
            Invite.status == "pending",
        )

    async def create_invite(
        self, actor: User, payload: CreateInviteRequest
    ) -> Tuple[Optional[dict], Optional[dict]]:
        from app.core.exceptions import PermissionDeniedException

        try:
            assert_can_invite_role(actor.role, payload.role)
        except PermissionDeniedException as exc:
            detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
            return None, {"role": [detail]}

        if payload.role in ROLES_REQUIRING_SALON_SETUP:
            return await self._create_salon_owner_invite(actor, payload)

        tenant_id = resolve_tenant_id_for_invite(
            actor.role, actor.tenant_id, payload.tenant_id
        )
        if not tenant_id:
            return None, {"tenant_id": ["Salon is required for this invitation"]}

        tenant = await Tenant.get(tenant_id)
        if not tenant or tenant.is_deleted:
            return None, {"tenant_id": ["Selected salon does not exist"]}

        existing_user = await User.find_one(
            User.email == payload.email,
            User.tenant_id == tenant_id,
            User.is_deleted == False,
        )
        if existing_user:
            return None, {"email": ["This email is already registered in this salon"]}

        pending = await self._pending_invite_for_email(str(payload.email))
        if pending:
            return None, {"email": ["A pending invitation already exists for this email"]}

        if payload.reporting_manager_id:
            manager = await User.get(payload.reporting_manager_id)
            if (
                not manager
                or manager.tenant_id != tenant_id
                or manager.role != ROLE_SALON_MANAGER
            ):
                return None, {"reporting_manager_id": ["Invalid reporting manager"]}

        first_name, last_name = self._split_full_name(payload.full_name)
        token_value = self._generate_token()
        invitation_link = f"{settings.FRONTEND_URL}/create-password?token={token_value}"

        email_sent, email_error = await send_team_invitation_email(
            to_email=str(payload.email),
            invitee_name=payload.full_name,
            role_label=ROLE_LABELS.get(payload.role, payload.role),
            salon_name=tenant.name,
            invitation_link=invitation_link,
        )
        if not email_sent:
            return None, {
                "email": [email_error or "Failed to send invitation email. Please try again."]
            }

        user = User(
            email=str(payload.email),
            phone=payload.phone or None,
            hashed_password=get_password_hash(secrets.token_urlsafe(32)),
            first_name=first_name,
            last_name=last_name,
            role=payload.role,
            is_active=False,
            status="INACTIVE",
            tenant_id=tenant_id,
            branch_name=payload.branch_name or None,
            created_by=str(actor.id),
        )
        await user.insert()

        expires_at = now_utc() + timedelta(hours=settings.INVITATION_TOKEN_EXPIRE_HOURS)
        invite = Invite(
            invited_by=str(actor.id),
            invited_email=str(payload.email),
            role=payload.role,
            full_name=payload.full_name,
            phone=payload.phone or None,
            salon_id=tenant_id,
            branch_id=payload.branch_id,
            branch_name=payload.branch_name or None,
            reporting_manager_id=payload.reporting_manager_id,
            token=token_value,
            expires_at=expires_at,
            status="pending",
            user_id=str(user.id),
        )
        await invite.insert()

        return self._invite_response(invite, tenant.name), None

    async def _create_salon_owner_invite(
        self, actor: User, payload: CreateInviteRequest
    ) -> Tuple[Optional[dict], Optional[dict]]:
        if actor.role != "super_admin":
            return None, {"role": ["Only super admin can invite salon owners"]}

        data, errors = await self._salon_owner_flow.create_invitation(
            salon_name=payload.salon_name or "",
            owner_full_name=payload.full_name,
            email=str(payload.email),
            owner_phone_number=payload.phone,
            salon_phone_number=payload.salon_phone_number,
            salon_type=payload.salon_type or "",
            branch_name=payload.branch_name,
            address=payload.address,
            subscription_plan=payload.subscription_plan or "",
            slug=payload.slug,
            username=payload.username,
        )
        if errors:
            return None, errors

        token_row = await InvitationToken.find_one(
            InvitationToken.salon_id == data["salon_id"]
        )
        if token_row:
            invite = Invite(
                invited_by=str(actor.id),
                invited_email=str(payload.email),
                role=ROLE_SALON_OWNER,
                full_name=payload.full_name,
                phone=payload.phone or None,
                salon_id=data["salon_id"],
                branch_name=payload.branch_name or None,
                token=token_row.token,
                expires_at=token_row.expires_at,
                status="pending",
                subscription_plan=payload.subscription_plan,
                trial_start_date=payload.trial_start_date,
                salon_name=payload.salon_name,
                salon_type=payload.salon_type,
                salon_phone_number=payload.salon_phone_number or None,
                address=payload.address or None,
                gst_number=payload.gst_number or None,
                user_id=data["owner_id"],
            )
            await invite.insert()

        return data, None

    def _invite_response(self, invite: Invite, salon_name: str = "") -> dict:
        return {
            "id": str(invite.id),
            "email": invite.invited_email,
            "role": invite.role,
            "salon_name": invite.salon_name or salon_name,
            "status": invite.status,
            "invitation_sent": True,
        }

    async def list_invites(
        self, actor: User, status: Optional[str] = None
    ) -> List[dict]:
        query: Dict[str, Any] = {}
        if status:
            query["status"] = status.strip().lower()

        if actor.role == "super_admin":
            invites = await Invite.find(query).sort(-Invite.created_at).to_list()
        elif actor.tenant_id:
            invites = await Invite.find(
                Invite.salon_id == actor.tenant_id,
                **query,
            ).sort(-Invite.created_at).to_list()
        else:
            invites = await Invite.find(
                Invite.invited_by == str(actor.id),
                **query,
            ).sort(-Invite.created_at).to_list()

        return [await self._serialize_invite(inv) for inv in invites]

    async def _serialize_invite(self, invite: Invite) -> dict:
        salon_name = invite.salon_name
        if not salon_name and invite.salon_id:
            tenant = await Tenant.get(invite.salon_id)
            salon_name = tenant.name if tenant else None

        return {
            "id": str(invite.id),
            "invited_email": invite.invited_email,
            "full_name": invite.full_name,
            "role": invite.role,
            "status": self._effective_status(invite),
            "salon_id": invite.salon_id,
            "salon_name": salon_name,
            "branch_name": invite.branch_name,
            "subscription_plan": invite.subscription_plan,
            "expires_at": invite.expires_at.isoformat(),
            "created_at": invite.created_at.isoformat(),
            "accepted_at": invite.accepted_at.isoformat() if invite.accepted_at else None,
            "resend_count": invite.resend_count,
        }

    @staticmethod
    def _effective_status(invite: Invite) -> str:
        if invite.status == "pending" and make_aware(invite.expires_at) < now_utc():
            return "expired"
        return invite.status

    async def _can_manage_invite(self, actor: User, invite: Invite) -> bool:
        if actor.role == "super_admin":
            return True
        if str(invite.invited_by) == str(actor.id):
            return True
        if (
            invite.salon_id
            and actor.tenant_id == invite.salon_id
            and actor.role in ("salon_owner", "salon_admin")
        ):
            return True
        return False

    async def resend_invite(
        self, actor: User, invite_id: str
    ) -> Tuple[Optional[dict], Optional[str]]:
        invite = await Invite.get(invite_id)
        if not invite:
            return None, "Invitation not found"

        if not await self._can_manage_invite(actor, invite):
            return None, "You are not allowed to manage this invitation"

        if invite.status != "pending":
            return None, "Only pending invitations can be resent"

        if make_aware(invite.expires_at) < now_utc():
            invite.status = "expired"
            await invite.save()
            return None, "Invitation has expired"

        if invite.resend_count >= RESEND_MAX:
            return None, "Maximum resend limit reached for this invitation"

        assert_can_invite_role(actor.role, invite.role)

        salon_name = invite.salon_name or "MyChair"
        if invite.salon_id:
            tenant = await Tenant.get(invite.salon_id)
            if tenant:
                salon_name = tenant.name

        invitation_link = f"{settings.FRONTEND_URL}/create-password?token={invite.token}"
        if invite.role == ROLE_SALON_OWNER:
            user = await User.get(invite.user_id) if invite.user_id else None
            username = user.username if user else invite.invited_email
            email_sent, email_error = await send_invitation_email(
                to_email=invite.invited_email,
                salon_name=salon_name,
                username=username or invite.invited_email,
                invitation_link=invitation_link,
            )
        else:
            email_sent, email_error = await send_team_invitation_email(
                to_email=invite.invited_email,
                invitee_name=invite.full_name,
                role_label=ROLE_LABELS.get(invite.role, invite.role),
                salon_name=salon_name,
                invitation_link=invitation_link,
            )

        if not email_sent:
            return None, email_error or "Failed to resend invitation email"

        invite.resend_count += 1
        await invite.save()
        return {"id": str(invite.id), "resend_count": invite.resend_count}, None

    async def cancel_invite(
        self, actor: User, invite_id: str
    ) -> Tuple[Optional[dict], Optional[str]]:
        invite = await Invite.get(invite_id)
        if not invite:
            return None, "Invitation not found"

        if not await self._can_manage_invite(actor, invite):
            return None, "You are not allowed to manage this invitation"

        if invite.status != "pending":
            return None, "Only pending invitations can be cancelled"

        assert_can_invite_role(actor.role, invite.role)

        invite.status = "cancelled"
        await invite.save()

        if invite.user_id and invite.role != ROLE_SALON_OWNER:
            user = await User.get(invite.user_id)
            if user and not user.is_active:
                await user.delete()

        return {"id": str(invite.id), "status": invite.status}, None

    async def validate_token(self, token: str) -> Tuple[Optional[dict], Optional[str]]:
        invite = await Invite.find_one(Invite.token == token)
        if invite:
            return await self._validate_invite_record(invite)

        return await self._salon_owner_flow.validate_token(token)

    async def _validate_invite_record(
        self, invite: Invite
    ) -> Tuple[Optional[dict], Optional[str]]:
        if invite.status == "cancelled":
            return None, "This invitation has been cancelled"
        if invite.status == "accepted":
            return None, "This invitation has already been used"
        if make_aware(invite.expires_at) < now_utc():
            if invite.status == "pending":
                invite.status = "expired"
                await invite.save()
            return None, "Invitation token has expired"

        salon_name = invite.salon_name or ""
        username = ""
        if invite.user_id:
            user = await User.get(invite.user_id)
            if user:
                salon_name = salon_name or user.salon_name or ""
                username = user.username or user.email

        return {
            "salon_name": salon_name,
            "email": invite.invited_email,
            "username": username or invite.invited_email,
            "full_name": invite.full_name,
            "role": invite.role,
            "expires_at": invite.expires_at.isoformat(),
            "is_valid": True,
        }, None

    async def accept_invite(
        self, token: str, password: str, confirm_password: str
    ) -> Tuple[Optional[dict], Optional[dict]]:
        if password != confirm_password:
            return None, {"confirm_password": ["Passwords do not match"]}

        invite = await Invite.find_one(Invite.token == token)
        if invite:
            return await self._accept_invite_record(invite, password)

        return await self._salon_owner_flow.create_password(
            token=token,
            password=password,
            confirm_password=confirm_password,
        )

    async def _accept_invite_record(
        self, invite: Invite, password: str
    ) -> Tuple[Optional[dict], Optional[dict]]:
        if invite.status == "cancelled":
            return None, {"token": ["This invitation has been cancelled"]}
        if invite.status == "accepted":
            return None, {"token": ["This invitation has already been used"]}
        if make_aware(invite.expires_at) < now_utc():
            invite.status = "expired"
            await invite.save()
            return None, {"token": ["Invitation token has expired"]}

        if invite.salon_id:
            tenant = await Tenant.get(invite.salon_id)
            if not tenant or tenant.is_deleted:
                return None, {"token": ["Salon is no longer available"]}

        user = await User.get(invite.user_id) if invite.user_id else None
        if not user:
            return None, {"token": ["User account not found"]}

        user.hashed_password = get_password_hash(password)
        user.is_active = True
        user.status = "ACTIVE"
        await user.save()

        invite.status = "accepted"
        invite.accepted_at = now_utc()
        await invite.save()

        legacy = await InvitationToken.find_one(InvitationToken.token == invite.token)
        if legacy and not legacy.is_used:
            legacy.is_used = True
            await legacy.save()

        return {"user_id": str(user.id), "email": user.email, "role": user.role}, None
