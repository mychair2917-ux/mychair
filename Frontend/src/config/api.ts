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
