import { canAccessModule, MODULES } from '../config/rbac';
import { INVITE_ROLES } from '../constants/invitation';
import { ROLES } from '../constants';

const INVITABLE_BY_ROLE: Record<string, string[]> = {
  [ROLES.SUPER_ADMIN]: [
    INVITE_ROLES.SALON_OWNER,
    INVITE_ROLES.MANAGER,
    INVITE_ROLES.STAFF,
  ],
  [ROLES.SALON_OWNER]: [INVITE_ROLES.MANAGER, INVITE_ROLES.STAFF],
  salon_admin: [INVITE_ROLES.MANAGER, INVITE_ROLES.STAFF],
  [INVITE_ROLES.MANAGER]: [INVITE_ROLES.STAFF],
  [INVITE_ROLES.STAFF]: [],
};

export function canUserInvite(role: string | undefined): boolean {
  if (!role) return false;
  if (!canAccessModule(role, MODULES.INVITE)) return false;
  return (INVITABLE_BY_ROLE[role]?.length ?? 0) > 0;
}

export function getInvitableRolesForUser(role: string | undefined): string[] {
  if (!role) return [];
  return INVITABLE_BY_ROLE[role] ?? [];
}

export function isSalonOwnerInviteRole(role: string): boolean {
  return role === INVITE_ROLES.SALON_OWNER;
}

/** Manager or staff/employee invite — show team fields, not salon onboarding. */
export function isStaffInviteRole(role: string): boolean {
  return role === INVITE_ROLES.MANAGER || role === INVITE_ROLES.STAFF;
}

export function requiresTenantSelection(
  inviterRole: string | undefined,
  targetRole: string
): boolean {
  return inviterRole === ROLES.SUPER_ADMIN && targetRole !== INVITE_ROLES.SALON_OWNER;
}

/** Manager and staff are always created with a password — no invitation email. */
export function usesDirectPasswordProvisioning(
  _inviterRole: string | undefined,
  targetRole: string
): boolean {
  return isStaffInviteRole(targetRole);
}
