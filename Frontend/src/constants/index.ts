export const HTTP_METHODS = {
  GET: 'GET',
  POST: 'POST',
  PUT: 'PUT',
  DELETE: 'DELETE',
  PATCH: 'PATCH',
} as const;

export const ROLES = {
  ADMIN: 'admin',
  USER: 'standard',
  SUPER_ADMIN: 'super_admin',
} as const;

export const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
} as const;

export const ROUTE_PATHS = {
  // Public routes
  ROOT: '',
  LOGIN: 'login',
  NOT_FOUND: '404',
  CATCH_ALL: '*',

  // Protected routes
  DASHBOARD: 'dashboard',
  PROFILE: 'profile',
  SETTINGS: 'settings',
};

export const TOAST_TYPES = {
  DEFAULT: 'default',
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
} as const;

export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml'];

export const PUBLIC_ROUTES = [
  `/${ROUTE_PATHS.LOGIN}`,
  `/${ROUTE_PATHS.ROOT}`,
];
