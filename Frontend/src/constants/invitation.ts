import { ROLES } from './index';

export const INVITE_ROLES = {
  SALON_OWNER: ROLES.SALON_OWNER,
  MANAGER: 'salon_manager',
  STAFF: 'employee',
} as const;

export type InviteRoleValue =
  | typeof INVITE_ROLES.SALON_OWNER
  | typeof INVITE_ROLES.MANAGER
  | typeof INVITE_ROLES.STAFF;

export const INVITE_ROLE_LABELS: Record<string, string> = {
  [INVITE_ROLES.SALON_OWNER]: 'Salon Owner',
  [INVITE_ROLES.MANAGER]: 'Manager',
  [INVITE_ROLES.STAFF]: 'Staff',
};

/** Roles that may access the invite UI (staff/employee cannot). */
export const ROLES_CAN_INVITE = [
  ROLES.SUPER_ADMIN,
  ROLES.SALON_OWNER,
  'salon_admin',
  INVITE_ROLES.MANAGER,
] as const;

export const INVITE_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;
