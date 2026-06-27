/**
 * Single source of truth for the backend API base URL.
 * Set via VITE_API_BASE_URL in .env.development / .env.production — never hardcode URLs in app code.
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

/** Derive a WebSocket base URL (with trailing slash) from the HTTP API base URL. */
export function getWebSocketBaseUrl(apiBaseUrl: string = API_BASE_URL): string {
  const url = new URL(apiBaseUrl);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  if (!url.pathname.endsWith('/')) {
    url.pathname = `${url.pathname}/`;
  }
  return url.toString();
}

/** HTTP origin (scheme + host) derived from API_BASE_URL — for dev-proxy configuration. */
export function getApiOrigin(apiBaseUrl: string = API_BASE_URL): string {
  return new URL(apiBaseUrl).origin;
}
