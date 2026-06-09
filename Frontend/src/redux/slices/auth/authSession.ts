import { isSuperAdmin } from '../../../config/rbac';
import { ROUTE_PATHS, ROLES } from '../../../constants';

export const AUTH_STORAGE_KEYS = [
  'token',
  'refresh_token',
  'user',
  'orgId',
  'selectedSalonId',
  'permissions',
] as const;

export const readStoredUser = () => {
  try {
    const rawUser = localStorage.getItem('user');
    return rawUser ? JSON.parse(rawUser) : null;
  } catch {
    return null;
  }
};

export const readStoredPermissions = (): Record<string, boolean> | null => {
  try {
    const raw = localStorage.getItem('permissions');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const clearMatchingCookies = () => {
  if (typeof document === 'undefined' || !document.cookie) {
    return;
  }

  document.cookie.split(';').forEach((cookie) => {
    const [rawName] = cookie.split('=');
    const name = rawName?.trim();

    if (!name || !/(token|auth|session|refresh)/i.test(name)) {
      return;
    }

    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Lax`;
  });
};

export const clearAuthStorage = () => {
  AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
  sessionStorage.clear();
  clearMatchingCookies();
};

export const getPostLogoutPath = (role?: string) =>
  role === ROLES.SALON_OWNER ? `/${ROUTE_PATHS.SALON_OWNER_LOGIN}` : `/${ROUTE_PATHS.LOGIN}`;

export const getProfilePath = (role: string | undefined, orgId: string | null | undefined) => {
  if (isSuperAdmin(role)) {
    return `/${ROUTE_PATHS.ADMIN_PROFILE}`;
  }

  return orgId ? `/orgs/${orgId}/${ROUTE_PATHS.PROFILE}` : null;
};

export const getSettingsPath = (role: string | undefined, orgId: string | null | undefined) => {
  if (isSuperAdmin(role)) {
    return `/${ROUTE_PATHS.ADMIN_SETTINGS}`;
  }

  return orgId ? `/orgs/${orgId}/${ROUTE_PATHS.SETTINGS}` : null;
};
