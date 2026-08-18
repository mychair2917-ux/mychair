import { baseApi } from '../api/baseApi';
import { API_PATHS } from '../api/apiPaths';
import type {
  AdminPlanConfig,
  FeatureItem,
  OwnerSubscriptionView,
  SubscriptionDashboardStats,
  SubscriptionPlan,
  SubscriptionRecord,
  SubscriptionStatus,
  UpdateSubscriptionPayload,
} from './Types';

export const subscriptionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSubscriptionDashboard: builder.query<SubscriptionDashboardStats, void>({
      query: () => API_PATHS.SUBSCRIPTIONS.DASHBOARD,
      transformResponse: (response: { data: SubscriptionDashboardStats }) => response.data,
      providesTags: ['Subscriptions'],
    }),
    listSubscriptions: builder.query<
      SubscriptionRecord[],
      { search?: string; status?: string; plan_name?: string } | void
    >({
      query: (params) => ({
        url: API_PATHS.SUBSCRIPTIONS.LIST,
        params: params ?? {},
      }),
      transformResponse: (response: { data: SubscriptionRecord[] }) => response.data,
      providesTags: ['Subscriptions'],
    }),
    getDefaultSubscriptionDays: builder.query<{ default_subscription_days: number }, void>({
      query: () => API_PATHS.SUBSCRIPTIONS.DEFAULT_DAYS,
      transformResponse: (response: { data: { default_subscription_days: number } }) => response.data,
      providesTags: ['SubscriptionSettings'],
    }),
    updateDefaultSubscriptionDays: builder.mutation<
      { default_subscription_days: number },
      { default_subscription_days: number }
    >({
      query: (body) => ({
        url: API_PATHS.SUBSCRIPTIONS.DEFAULT_DAYS,
        method: 'PUT',
        body,
      }),
      transformResponse: (response: { data: { default_subscription_days: number } }) => response.data,
      invalidatesTags: ['SubscriptionSettings', 'Subscriptions'],
    }),
    updateSubscription: builder.mutation<SubscriptionRecord, { id: string; body: UpdateSubscriptionPayload }>({
      query: ({ id, body }) => ({
        url: API_PATHS.SUBSCRIPTIONS.DETAIL(id),
        method: 'PUT',
        body,
      }),
      transformResponse: (response: { data: SubscriptionRecord }) => response.data,
      invalidatesTags: ['Subscriptions', 'SubscriptionStatus', 'AdminPlans'],
    }),
    getMySubscription: builder.query<OwnerSubscriptionView, void>({
      query: () => API_PATHS.SUBSCRIPTIONS.ME,
      transformResponse: (response: { data: OwnerSubscriptionView }) => response.data,
      providesTags: ['Subscriptions'],
    }),
    getSubscriptionStatus: builder.query<SubscriptionStatus, void>({
      query: () => API_PATHS.SUBSCRIPTIONS.ME_STATUS,
      transformResponse: (response: { data: SubscriptionStatus }) => response.data,
      providesTags: ['SubscriptionStatus'],
    }),
    getSubscriptionPlans: builder.query<SubscriptionPlan[], void>({
      query: () => API_PATHS.SUBSCRIPTIONS.PLANS,
      transformResponse: (response: { data: SubscriptionPlan[] }) => response.data,
    }),
    getFeatureCatalog: builder.query<FeatureItem[], void>({
      query: () => API_PATHS.SUBSCRIPTIONS.ADMIN_FEATURES,
      transformResponse: (response: { data: FeatureItem[] }) => response.data,
    }),
    getAdminPlans: builder.query<AdminPlanConfig[], void>({
      query: () => API_PATHS.SUBSCRIPTIONS.ADMIN_PLANS,
      transformResponse: (response: { data: AdminPlanConfig[] }) => response.data,
      providesTags: ['AdminPlans'],
    }),
    updatePlanFeatures: builder.mutation<
      AdminPlanConfig,
      { plan_key: string; features: string[] }
    >({
      query: ({ plan_key, features }) => ({
        url: API_PATHS.SUBSCRIPTIONS.ADMIN_PLAN_FEATURES(plan_key),
        method: 'PUT',
        body: { features },
      }),
      transformResponse: (response: { data: AdminPlanConfig }) => response.data,
      invalidatesTags: ['AdminPlans', 'SubscriptionStatus'],
    }),
  }),
});

export const {
  useGetSubscriptionDashboardQuery,
  useListSubscriptionsQuery,
  useGetDefaultSubscriptionDaysQuery,
  useUpdateDefaultSubscriptionDaysMutation,
  useUpdateSubscriptionMutation,
  useGetMySubscriptionQuery,
  useGetSubscriptionStatusQuery,
  useGetSubscriptionPlansQuery,
  useGetFeatureCatalogQuery,
  useGetAdminPlansQuery,
  useUpdatePlanFeaturesMutation,
} = subscriptionsApi;
