import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import {
  DailyEarningsRow,
  EarningsActivityItem,
  EarningsSummary,
  IncentiveBreakdown,
  MyEarningsQueryParams,
  SalaryHistoryResponse,
  WalletOverview,
} from './Types';
import { SalarySlip } from '../payroll/Types';

export const myEarningsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMyEarningsSummary: builder.query<ApiResponse<EarningsSummary>, MyEarningsQueryParams | void>({
      query: (params) => ({
        url: API_PATHS.MY_EARNINGS.SUMMARY,
        method: HTTP_METHODS.GET,
        params: params ?? undefined,
      }),
      providesTags: ['MyEarnings'],
    }),
    listMyDailyEarnings: builder.query<ApiResponse<DailyEarningsRow[]>, MyEarningsQueryParams | void>({
      query: (params) => ({
        url: API_PATHS.MY_EARNINGS.DAILY,
        method: HTTP_METHODS.GET,
        params: params ?? undefined,
      }),
      providesTags: ['MyEarnings'],
    }),
    getMyWallet: builder.query<ApiResponse<WalletOverview>, MyEarningsQueryParams | void>({
      query: (params) => ({
        url: API_PATHS.MY_EARNINGS.WALLET,
        method: HTTP_METHODS.GET,
        params: params ?? undefined,
      }),
      providesTags: ['MyEarnings'],
    }),
    listMySalaryHistory: builder.query<
      ApiResponse<SalaryHistoryResponse>,
      { page?: number; limit?: number; employeeId?: string }
    >({
      query: (params) => ({
        url: API_PATHS.MY_EARNINGS.SALARY_HISTORY,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['MyEarnings'],
    }),
    getMySalarySlip: builder.query<ApiResponse<SalarySlip>, { payrollId: string; employeeId?: string }>({
      query: ({ payrollId, employeeId }) => ({
        url: API_PATHS.MY_EARNINGS.SALARY_SLIP(payrollId),
        method: HTTP_METHODS.GET,
        params: employeeId ? { employeeId } : undefined,
      }),
    }),
    getMyIncentiveBreakdown: builder.query<
      ApiResponse<IncentiveBreakdown>,
      MyEarningsQueryParams | void
    >({
      query: (params) => ({
        url: API_PATHS.MY_EARNINGS.BREAKDOWN,
        method: HTTP_METHODS.GET,
        params: params ?? undefined,
      }),
      providesTags: ['MyEarnings'],
    }),
    listMyRecentActivity: builder.query<
      ApiResponse<EarningsActivityItem[]>,
      (MyEarningsQueryParams & { limit?: number }) | void
    >({
      query: (params) => ({
        url: API_PATHS.MY_EARNINGS.ACTIVITY,
        method: HTTP_METHODS.GET,
        params: params ?? undefined,
      }),
      providesTags: ['MyEarnings'],
    }),
  }),
});

export const {
  useGetMyEarningsSummaryQuery,
  useListMyDailyEarningsQuery,
  useGetMyWalletQuery,
  useListMySalaryHistoryQuery,
  useLazyGetMySalarySlipQuery,
  useGetMyIncentiveBreakdownQuery,
  useListMyRecentActivityQuery,
} = myEarningsApi;
