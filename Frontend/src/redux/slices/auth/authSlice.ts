import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { clearAuthStorage, readStoredUser } from './authSession';

export interface AuthUser {
  id?: string;
  email: string;
  role: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  alternate_phone?: string;
  avatar?: string | null;
  employee_id?: string;
  employee_code?: string;
  branch_name?: string;
  branch_id?: string;
  salon_name?: string;
  department?: string;
  designation?: string;
  shift?: string;
  status?: string;
  joining_date?: string | null;
  last_login?: string | null;
}

export function getUserDisplayName(user: AuthUser | null | undefined): string {
  if (!user) return '';
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  if (fullName) return fullName;
  if (user.username?.trim()) return user.username.trim();
  if (user.email) return user.email.split('@')[0];
  return '';
}

export interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  orgId: string | null;
  selectedSalonId: string | null;
}

const initialState: AuthState = {
  token: localStorage.getItem('token') || null,
  refreshToken: localStorage.getItem('refresh_token') || null,
  user: readStoredUser(),
  orgId: localStorage.getItem('orgId') || null,
  selectedSalonId: localStorage.getItem('selectedSalonId') || null,
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
      state.selectedSalonId = action.payload.orgId && action.payload.orgId !== 'system'
        ? action.payload.orgId
        : null;

      localStorage.setItem('token', action.payload.token);
      localStorage.setItem('refresh_token', action.payload.refreshToken);
      localStorage.setItem('user', JSON.stringify(action.payload.user));
      localStorage.setItem('orgId', action.payload.orgId);
      if (state.selectedSalonId) {
        localStorage.setItem('selectedSalonId', state.selectedSalonId);
      } else {
        localStorage.removeItem('selectedSalonId');
      }
    },
    setSelectedSalonId: (state, action: PayloadAction<string | null>) => {
      state.selectedSalonId = action.payload;
      if (action.payload) {
        localStorage.setItem('selectedSalonId', action.payload);
      } else {
        localStorage.removeItem('selectedSalonId');
      }
    },
    updateAuthUser: (state, action: PayloadAction<Partial<AuthUser>>) => {
      if (!state.user) return;
      state.user = { ...state.user, ...action.payload };
      localStorage.setItem('user', JSON.stringify(state.user));
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.orgId = null;
      state.selectedSalonId = null;
      clearAuthStorage();
    },
  },
});

export const { setCredentials, setSelectedSalonId, updateAuthUser, logout } = authSlice.actions;
export default authSlice.reducer;
