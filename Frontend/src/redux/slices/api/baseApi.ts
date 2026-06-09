import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { RootState } from '../../store';
import { logout } from '../auth/authSlice';

const rawBaseQuery = fetchBaseQuery({
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
});

const baseQueryWithAuthHandling: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extraOptions
) => {
  const result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    api.dispatch(logout());
  }

  return result;
};

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
    'Brands',
    'Inventory',
    'Bills',
    'SalaryStructure',
    'Payroll',
    'PayrollHistory',
    'MyEarnings',
    'CustomerAnalytics',
    'Customers',
    'RewardSettings',
    'Profile',
    'Expenses',
    'Attendance',
    'BranchLocation',
    'Permissions',
  ],
  baseQuery: baseQueryWithAuthHandling,
  endpoints: (builder) => ({
    getExample: builder.query<any, void>({
      query: () => '/example',
    }),
  }),
});

export const { useGetExampleQuery } = baseApi;
