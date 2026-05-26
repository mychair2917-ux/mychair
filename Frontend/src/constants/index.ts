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
  SALON_OWNER: 'salon_owner',
  SALON_ADMIN: 'salon_admin',
  SALON_MANAGER: 'salon_manager',
  EMPLOYEE: 'employee',
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
  SALON_EMPLOYEES: 'salon-management/employees',
  SALON_SERVICES: 'salon-management/services',
  USER_MANAGEMENT: 'user-management',
  ROLES_PERMISSIONS: 'roles-permissions',
  SUBSCRIPTION_MANAGEMENT: 'subscription-management',
  BILLING_FINANCE: 'billing-finance',
  PRODUCTS_INVENTORY: 'products-inventory',
  STAFF_MONITORING: 'staff-monitoring',
  CUSTOMER_ANALYTICS: 'customer-analytics',
  NOTIFICATIONS_COMMUNICATION: 'notifications-communication',

  // Super Admin routes (no org scope)
  ADMIN_DASHBOARD: 'admin/dashboard',
  ADMIN_INVITE: 'admin/invite',
  SALON_INVITE: 'salon-owner/invite',
  ORG_INVITE: 'invite-users',
  ADMIN_SALON_MANAGEMENT: 'admin/salon-management',
  ADMIN_SALON_EMPLOYEES: 'admin/salon-management/employees',
  ADMIN_SALON_SERVICES: 'admin/salon-management/services',
  ADMIN_USER_MANAGEMENT: 'admin/user-management',
  ADMIN_ROLES_PERMISSIONS: 'admin/roles-permissions',
  ADMIN_SUBSCRIPTION_MANAGEMENT: 'admin/subscription-management',
  ADMIN_BILLING_FINANCE: 'admin/billing-finance',
  ADMIN_PRODUCTS_INVENTORY: 'admin/products-inventory',
  ADMIN_STAFF_MONITORING: 'admin/staff-monitoring',
  ADMIN_CUSTOMER_ANALYTICS: 'admin/customer-analytics',
  ADMIN_NOTIFICATIONS_COMMUNICATION: 'admin/notifications-communication',

  // Super admin & salon owner invitation flow
  INVITE: 'invite',
  CREATE_PASSWORD: 'create-password',
  SALON_OWNER_LOGIN: 'salon-owner/login',
  SALON_OWNER_DASHBOARD: 'salon-owner/dashboard',
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
  `/${ROUTE_PATHS.CREATE_PASSWORD}`,
  `/${ROUTE_PATHS.SALON_OWNER_LOGIN}`,
];
