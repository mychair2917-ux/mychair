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

  // Salon ERP Module routes
  SALON_MANAGEMENT: 'salon-management',
  USER_MANAGEMENT: 'user-management',
  ROLES_PERMISSIONS: 'roles-permissions',
  SUBSCRIPTION_MANAGEMENT: 'subscription-management',
  BILLING_FINANCE: 'billing-finance',
  PRODUCTS_INVENTORY: 'products-inventory',
  STAFF_MONITORING: 'staff-monitoring',
  CUSTOMER_ANALYTICS: 'customer-analytics',
  NOTIFICATIONS_COMMUNICATION: 'notifications-communication',
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
