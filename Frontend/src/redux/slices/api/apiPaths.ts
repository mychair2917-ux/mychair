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
    CREATE: '/invitations',
    VALIDATE: (token: string) => `/invitations/${token}`,
    CREATE_PASSWORD: '/invitations/create-password',
  },
  SALON_OWNER: {
    PROFILE: '/salon-owner/profile',
  },
};
