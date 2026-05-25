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
};
