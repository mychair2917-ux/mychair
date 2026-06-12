"""Role hierarchy checks for invitation creation."""

from typing import FrozenSet, Optional

from app.core.exceptions import PermissionDeniedException

# Roles that may be assigned via invitation (API values)
ROLE_SALON_OWNER = "salon_owner"
ROLE_SALON_MANAGER = "salon_manager"
ROLE_EMPLOYEE = "employee"
ROLE_SALON_ADMIN = "salon_admin"

INVITABLE_ROLES: dict[str, FrozenSet[str]] = {
    "super_admin": frozenset({ROLE_SALON_OWNER, ROLE_SALON_MANAGER, ROLE_EMPLOYEE}),
    ROLE_SALON_OWNER: frozenset({ROLE_SALON_MANAGER, ROLE_EMPLOYEE}),
    ROLE_SALON_ADMIN: frozenset({ROLE_SALON_MANAGER, ROLE_EMPLOYEE}),
    ROLE_SALON_MANAGER: frozenset({ROLE_EMPLOYEE}),
    ROLE_EMPLOYEE: frozenset(),
}

ROLES_REQUIRING_SALON_SETUP = frozenset({ROLE_SALON_OWNER})
ROLES_REQUIRING_TENANT = frozenset({ROLE_SALON_MANAGER, ROLE_EMPLOYEE, ROLE_SALON_ADMIN})
ROLES_DIRECT_PASSWORD_SETUP = frozenset({ROLE_SALON_MANAGER, ROLE_EMPLOYEE})

TENANT_INVITER_ROLES = frozenset(
    {ROLE_SALON_OWNER, ROLE_SALON_ADMIN, ROLE_SALON_MANAGER}
)


def can_invite(actor_role: str) -> bool:
    return bool(INVITABLE_ROLES.get(actor_role))


def can_invite_role(actor_role: str, target_role: str) -> bool:
    allowed = INVITABLE_ROLES.get(actor_role, frozenset())
    return target_role in allowed


def assert_can_invite(actor_role: str) -> None:
    if not can_invite(actor_role):
        raise PermissionDeniedException(
            detail="Your role is not permitted to send invitations"
        )


def assert_can_invite_role(actor_role: str, target_role: str) -> None:
    assert_can_invite(actor_role)
    if not can_invite_role(actor_role, target_role):
        raise PermissionDeniedException(
            detail=f"Role '{actor_role}' cannot invite users with role '{target_role}'"
        )


def uses_direct_password_provisioning(actor_role: str, target_role: str) -> bool:
    """
    Manager and staff are always created with a password — no invitation email.
    Salon owner invitations still use the email flow.
    """
    if target_role not in ROLES_DIRECT_PASSWORD_SETUP:
        return False
    return actor_role in TENANT_INVITER_ROLES


def resolve_tenant_id_for_invite(
    actor_role: str,
    actor_tenant_id: Optional[str],
    payload_tenant_id: Optional[str],
) -> Optional[str]:
    """Resolve tenant scope for manager/staff invitations."""
    if actor_role == "super_admin":
        return payload_tenant_id
    if actor_role in (ROLE_SALON_OWNER, ROLE_SALON_ADMIN, ROLE_SALON_MANAGER):
        return actor_tenant_id
    return None
