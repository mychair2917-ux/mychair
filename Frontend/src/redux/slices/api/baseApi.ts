import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../../store';
import { logout } from '../auth/authSlice';

export const baseApi = createApi({
  reducerPath: 'api',
  tagTypes: [
    'Invites',
    'Employees',
    'Appointments',
    'AppointmentClients',
    'MasterServices',
    'SalonServices',
    'MasterProducts',
    'SalonProducts',
    'Bills',
  ],
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_BASE_URL || '/api/v1',
    prepareHeaders: (headers, { getState }) => {
      const state = (getState() as RootState).auth;
      const token = state.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      if (state.selectedSalonId) {
        headers.set('X-Tenant-ID', state.selectedSalonId);
      }
      return headers;
    },
  }),
  endpoints: (builder) => ({
    getExample: builder.query<any, void>({
      query: () => '/example',
    }),
  }),
});

export const { useGetExampleQuery } = baseApi;
