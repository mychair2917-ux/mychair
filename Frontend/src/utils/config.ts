const BASE_URL: string = import.meta.env.VITE_BASE_URL;
const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET: string = import.meta.env.VITE_CLIENT_SECRET;
const NAVIGATION_URL: string = import.meta.env.VITE_NAVIGATION_URL;
const GOOGLE_TOKEN_URL: string = import.meta.env.VITE_GOOGLE_TOKEN_URL;
const GOOGLE_AUTH_URL = `https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/userinfo.email%20https://www.googleapis.com/auth/userinfo.profile&access_type=offline&include_granted_scopes=true&response_type=code&state=state_parameter_passthrought_value&redirect_uri=${import.meta.env.VITE_NAVIGATION_URL}/login&client_id=${import.meta.env.VITE_GOOGLE_CLIENT_ID}`;
// Dynamically compute the WebSocket URL in the browser if VITE_WS_BASE_URL is not set as an absolute URL
const getWebSocketBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_WS_BASE_URL;
  if (envUrl && envUrl.startsWith('ws')) {
    return envUrl;
  }
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const basePath = import.meta.env.VITE_BASE_URL || '/api/v1';
    
    // Extract pathname if VITE_BASE_URL happens to be a full HTTP URL, otherwise use it directly
    const cleanPath = basePath.startsWith('http')
      ? new URL(basePath).pathname
      : basePath;
      
    // Ensure trailing slash
    const formattedPath = cleanPath.endsWith('/') ? cleanPath : `${cleanPath}/`;
    return `${protocol}//${host}${formattedPath}`;
  }
  return 'ws://localhost:8000/api/v1/';
};

const WS_BASE_URL: string = getWebSocketBaseUrl();

export {
  BASE_URL,
  GOOGLE_CLIENT_ID,
  CLIENT_SECRET,
  NAVIGATION_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_AUTH_URL,
  WS_BASE_URL,
};
