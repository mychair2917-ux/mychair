import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import { DashboardData, DashboardQueryParams } from './Types';

export const dashboardApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getDashboard: builder.query<ApiResponse<DashboardData>, DashboardQueryParams | void>({
      query: (params) => ({
        url: API_PATHS.DASHBOARD,
        method: HTTP_METHODS.GET,
        params: params ?? undefined,
      }),
      providesTags: ['Dashboard'],
    }),
  }),
});

export const { useGetDashboardQuery } = dashboardApi;
