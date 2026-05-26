import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '../../store';
import { logout } from '../auth/authSlice';

export const baseApi = createApi({
  reducerPath: 'api',
  tagTypes: ['Invites', 'Employees'],
  baseQuery: fetchBaseQuery({
    baseUrl: import.meta.env.VITE_BASE_URL || '/api',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
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
