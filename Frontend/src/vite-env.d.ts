/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_APP_NAME: string;
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_CLIENT_SECRET: string;
  readonly VITE_NAVIGATION_URL: string;
  readonly VITE_GOOGLE_TOKEN_URL: string;
  readonly VITE_USE_POLLING: string;
  readonly VITE_PROXY_TARGET: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
