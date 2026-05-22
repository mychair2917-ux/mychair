export interface GoogleOAuthTokenResponse {
  access_token: string | null;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  refresh_token: string;
  role: string;
  tenant_id: string;
}

export interface WithRefreshToken {
  refresh_token: string | null;
}

export interface RefreshTokenResponse extends WithRefreshToken {
  access_token: string | null;
}

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  logBackIn: boolean;
}

export interface ResetPasswordRequest {
  token?: string;
  new_password_provided: string;
}

export interface ResetPasswordResponse {
  message: string;
  detail?: string;
}

export interface GetLogOutUserResponse {
  message: string;
}

export interface GetLogOutUserParams {
  refresh_token: string | null;
}
