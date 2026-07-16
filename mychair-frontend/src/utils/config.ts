const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET: string = import.meta.env.VITE_CLIENT_SECRET;
const NAVIGATION_URL: string = import.meta.env.VITE_NAVIGATION_URL;
const GOOGLE_TOKEN_URL: string = import.meta.env.VITE_GOOGLE_TOKEN_URL;
const GOOGLE_AUTH_URL = `https://accounts.google.com/o/oauth2/v2/auth?scope=https://www.googleapis.com/auth/userinfo.email%20https://www.googleapis.com/auth/userinfo.profile&access_type=offline&include_granted_scopes=true&response_type=code&state=state_parameter_passthrought_value&redirect_uri=${import.meta.env.VITE_NAVIGATION_URL}/login&client_id=${import.meta.env.VITE_GOOGLE_CLIENT_ID}`;

export {
  GOOGLE_CLIENT_ID,
  CLIENT_SECRET,
  NAVIGATION_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_AUTH_URL,
};
