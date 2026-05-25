import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface AuthUser {
  email: string;
  role: string;
  username?: string;
}

export function getUserDisplayName(user: AuthUser | null | undefined): string {
  if (!user) return '';
  if (user.username?.trim()) return user.username.trim();
  if (user.email) return user.email.split('@')[0];
  return '';
}

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  orgId: string | null;
}

const initialState: AuthState = {
  token: localStorage.getItem('token') || null,
  refreshToken: localStorage.getItem('refresh_token') || null,
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  orgId: localStorage.getItem('orgId') || null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (
      state,
      action: PayloadAction<{ user: AuthUser; token: string; refreshToken: string; orgId: string }>
    ) => {
      state.user = action.payload.user;
      state.token = action.payload.token;
      state.refreshToken = action.payload.refreshToken;
      state.orgId = action.payload.orgId;

      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('refresh_token', action.payload.refreshToken);
      localStorage.setItem('user', JSON.stringify(action.payload.user));
      localStorage.setItem('orgId', action.payload.orgId);
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.orgId = null;
      localStorage.clear();
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;
