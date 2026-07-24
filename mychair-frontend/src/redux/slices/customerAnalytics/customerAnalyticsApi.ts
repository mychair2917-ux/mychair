import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import type {
  Customer,
  CustomerDetail,
  CustomerListParams,
  CustomerCreatePayload,
  CustomerUpdatePayload,
  CustomerImportResult,
  OverviewKPIs,
  PaginatedCustomers,
  RewardSettings,
  RewardSegment,
  RewardSettingsUpdatePayload,
  SegmentCreatePayload,
  SegmentUpdatePayload,
} from './Types';

export const customerAnalyticsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // ── Overview ──────────────────────────────────────────────────────────
    getCustomerAnalyticsOverview: builder.query<ApiResponse<OverviewKPIs>, void>({
      query: () => ({
        url: API_PATHS.CUSTOMER_ANALYTICS.OVERVIEW,
        method: HTTP_METHODS.GET,
      }),
      providesTags: ['CustomerAnalytics'],
    }),

    // ── Customers ─────────────────────────────────────────────────────────
    getCustomers: builder.query<ApiResponse<PaginatedCustomers>, CustomerListParams>({
      query: (params) => {
        const qp: Record<string, string | number> = {};
        if (params.page) qp.page = params.page;
        if (params.limit) qp.limit = params.limit;
        if (params.search) qp.search = params.search;
        if (params.gender) qp.gender = params.gender;
        if (params.status) qp.status = params.status;
        return {
          url: API_PATHS.CUSTOMER_ANALYTICS.CUSTOMERS,
          method: HTTP_METHODS.GET,
          params: qp,
        };
      },
      providesTags: ['Customers'],
    }),

    getCustomerById: builder.query<ApiResponse<CustomerDetail>, string>({
      query: (id) => ({
        url: API_PATHS.CUSTOMER_ANALYTICS.CUSTOMER_DETAIL(id),
        method: HTTP_METHODS.GET,
      }),
      providesTags: (_result, _error, id) => [{ type: 'Customers', id }],
    }),

    createCustomer: builder.mutation<ApiResponse<Customer>, CustomerCreatePayload>({
      query: (payload) => ({
        url: API_PATHS.CUSTOMER_ANALYTICS.CUSTOMERS,
        method: HTTP_METHODS.POST,
        body: payload,
      }),
      invalidatesTags: ['Customers', 'CustomerAnalytics'],
    }),

    updateCustomer: builder.mutation<ApiResponse<Customer>, CustomerUpdatePayload>({
      query: ({ id, ...body }) => ({
        url: API_PATHS.CUSTOMER_ANALYTICS.CUSTOMER_DETAIL(id),
        method: HTTP_METHODS.PUT,
        body,
      }),
      invalidatesTags: (_result, _error, { id }) => [
        'Customers',
        'CustomerAnalytics',
        { type: 'Customers', id },
      ],
    }),

    deleteCustomer: builder.mutation<ApiResponse<null>, string>({
      query: (id) => ({
        url: API_PATHS.CUSTOMER_ANALYTICS.CUSTOMER_DETAIL(id),
        method: HTTP_METHODS.DELETE,
      }),
      invalidatesTags: ['Customers', 'CustomerAnalytics'],
    }),

    importCustomers: builder.mutation<ApiResponse<CustomerImportResult>, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append('file', file);
        return {
          url: API_PATHS.CUSTOMER_ANALYTICS.IMPORT,
          method: HTTP_METHODS.POST,
          body: formData,
        };
      },
      invalidatesTags: ['Customers', 'CustomerAnalytics'],
    }),

    downloadCustomerImportTemplate: builder.query<Blob, 'xlsx' | 'csv'>({
      query: (format) => ({
        url: API_PATHS.CUSTOMER_ANALYTICS.IMPORT_TEMPLATE,
        method: HTTP_METHODS.GET,
        params: { format },
        responseHandler: (response: Response) => response.blob(),
      }),
    }),

    // ── Reward Settings ───────────────────────────────────────────────────
    getRewardSettings: builder.query<ApiResponse<RewardSettings>, void>({
      query: () => ({
        url: API_PATHS.CUSTOMER_ANALYTICS.REWARD_SETTINGS,
        method: HTTP_METHODS.GET,
      }),
      providesTags: ['RewardSettings'],
    }),

    updateRewardSettings: builder.mutation<
      ApiResponse<RewardSettings>,
      RewardSettingsUpdatePayload
    >({
      query: (payload) => ({
        url: API_PATHS.CUSTOMER_ANALYTICS.REWARD_SETTINGS,
        method: HTTP_METHODS.PUT,
        body: payload,
      }),
      invalidatesTags: ['RewardSettings'],
    }),

    createRewardSegment: builder.mutation<ApiResponse<RewardSegment>, SegmentCreatePayload>({
      query: (payload) => ({
        url: API_PATHS.CUSTOMER_ANALYTICS.REWARD_SEGMENTS,
        method: HTTP_METHODS.POST,
        body: payload,
      }),
      invalidatesTags: ['RewardSettings'],
    }),

    updateRewardSegment: builder.mutation<ApiResponse<RewardSegment>, SegmentUpdatePayload>({
      query: ({ id, ...body }) => ({
        url: API_PATHS.CUSTOMER_ANALYTICS.REWARD_SEGMENT_DETAIL(id),
        method: HTTP_METHODS.PUT,
        body,
      }),
      invalidatesTags: ['RewardSettings'],
    }),

    deleteRewardSegment: builder.mutation<ApiResponse<null>, string>({
      query: (id) => ({
        url: API_PATHS.CUSTOMER_ANALYTICS.REWARD_SEGMENT_DETAIL(id),
        method: HTTP_METHODS.DELETE,
      }),
      invalidatesTags: ['RewardSettings'],
    }),
  }),
});

export const {
  useGetCustomerAnalyticsOverviewQuery,
  useGetCustomersQuery,
  useGetCustomerByIdQuery,
  useCreateCustomerMutation,
  useUpdateCustomerMutation,
  useDeleteCustomerMutation,
  useImportCustomersMutation,
  useLazyDownloadCustomerImportTemplateQuery,
  useGetRewardSettingsQuery,
  useUpdateRewardSettingsMutation,
  useCreateRewardSegmentMutation,
  useUpdateRewardSegmentMutation,
  useDeleteRewardSegmentMutation,
} = customerAnalyticsApi;
