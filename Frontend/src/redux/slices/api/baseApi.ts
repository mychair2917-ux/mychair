import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { RootState } from '../../store';
import { logout, setRefreshedTokens, setSubscriptionExpired } from '../auth/authSlice';
import { API_PATHS } from './apiPaths';

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
  let result = await rawBaseQuery(args, api, extraOptions);

  if (result.error?.status === 401) {
    const state = api.getState() as RootState;
    const refreshToken = state.auth.refreshToken;
    if (refreshToken) {
      const refreshResult = await rawBaseQuery(
        {
          url: API_PATHS.AUTH_REFRESH,
          method: 'POST',
          body: { refresh_token: refreshToken },
        },
        api,
        extraOptions
      );

      const refreshData = refreshResult.data as
        | { success?: boolean; message?: string; data?: { access_token: string; refresh_token: string } }
        | undefined;

      if (refreshData?.success && refreshData.data?.access_token) {
        api.dispatch(
          setRefreshedTokens({
            token: refreshData.data.access_token,
            refreshToken: refreshData.data.refresh_token,
          })
        );
        result = await rawBaseQuery(args, api, extraOptions);
      } else if (refreshData?.message === 'SUBSCRIPTION_EXPIRED') {
        api.dispatch(setSubscriptionExpired(true));
      } else {
        api.dispatch(logout());
      }
    } else {
      api.dispatch(logout());
    }
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
    'Subscriptions',
    'SubscriptionSettings',
    'SubscriptionStatus',
  ],
  baseQuery: baseQueryWithAuthHandling,
  endpoints: (builder) => ({
    getExample: builder.query<any, void>({
      query: () => '/example',
    }),
  }),
});

export const { useGetExampleQuery } = baseApi;
