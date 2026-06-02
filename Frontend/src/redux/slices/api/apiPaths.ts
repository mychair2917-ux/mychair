export const API_PATHS = {
  EXAMPLE: '/example',
  AUTH: {
    LOGIN: '/auth/login',
    SALON_OWNER_LOGIN: '/auth/salon-owner/login',
    GOOGLE_OAUTH: '/auth/google',
    RESET_PASSWORD: '/auth/reset-password',
    LOGOUT_USER: '/auth/logout',
    RESET_PASSWORD_LINK: '/auth/forgot-password',
  },
  INVITATIONS: {
    CREATE: '/invites',
    LIST: '/invites',
    FORM_OPTIONS: '/invites/form-options',
    VALIDATE: (token: string) => `/invites/${token}`,
    CREATE_PASSWORD: '/invites/create-password',
    ACCEPT: '/invites/accept',
    RESEND: '/invites/resend',
    CANCEL: '/invites/cancel',
  },
  SALON_OWNER: {
    PROFILE: '/salon-owner/profile',
  },
  EMPLOYEES: {
    LIST: '/employees',
    DETAIL: (id: string) => `/employees/${id}`,
    STATUS: (id: string) => `/employees/${id}/status`,
    RESET_PASSWORD: (id: string) => `/employees/${id}/reset-password`,
  },
  SALON_SERVICES: {
    MASTER_LIST: '/services',
    LIST: '/salon-services',
    DETAIL: (id: string) => `/salon-services/${id}`,
  },
  SALON_PRODUCTS: {
    MASTER_LIST: '/products',
    LIST: '/salon-products',
    DETAIL: (id: string) => `/salon-products/${id}`,
  },
  SALONS: {
    LIST: '/salons/list',
  },
  APPOINTMENTS: {
    TODAY: '/appointments/frontdesk/today',
    CREATE_FRONTDESK: '/appointments/frontdesk',
    LIST: '/appointments/list',
    CLIENTS: '/appointments/clients',
    CLIENT_HISTORY: (id: string) => `/appointments/clients/${id}/history`,
    SERVICES: '/appointments/services',
    SALON_SERVICES: '/appointments/salon-services',
    SALON_PRODUCTS: '/appointments/salon-products',
    STAFF: '/appointments/staff',
  },
  BILLING: {
    BILLS: '/billing/bills',
  },
};
