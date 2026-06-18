import { HTTP_METHODS } from '../../../constants';
import type { ApiResponse } from '../api/Types';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import type {
  BusinessAlert,
  CampaignCreateRequest,
  CommunicationCampaign,
  CommunicationLog,
  NotificationItem,
  NotificationListParams,
  NotificationPreferences,
  NotificationTemplate,
  PaginatedCollection,
  PaginatedNotifications,
  TemplateCreateRequest,
} from './Types';

export const notificationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listNotifications: builder.query<ApiResponse<PaginatedNotifications>, NotificationListParams>({
      query: (params) => ({
        url: API_PATHS.NOTIFICATIONS.LIST,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['Notifications'],
    }),
    getUnreadNotificationCount: builder.query<ApiResponse<{ unread_count: number }>, { salon_id?: string } | void>({
      query: (params) => ({
        url: API_PATHS.NOTIFICATIONS.UNREAD_COUNT,
        method: HTTP_METHODS.GET,
        params: params ?? undefined,
      }),
      providesTags: ['Notifications'],
    }),
    markNotificationRead: builder.mutation<ApiResponse<NotificationItem>, string>({
      query: (id) => ({
        url: API_PATHS.NOTIFICATIONS.MARK_READ(id),
        method: HTTP_METHODS.PATCH,
      }),
      invalidatesTags: ['Notifications'],
    }),
    markAllNotificationsRead: builder.mutation<ApiResponse<{ updated: number }>, { salon_id?: string } | void>({
      query: (params) => ({
        url: API_PATHS.NOTIFICATIONS.MARK_ALL_READ,
        method: HTTP_METHODS.PATCH,
        params: params ?? undefined,
      }),
      invalidatesTags: ['Notifications'],
    }),
    getNotificationPreferences: builder.query<ApiResponse<NotificationPreferences>, void>({
      query: () => ({
        url: API_PATHS.NOTIFICATIONS.PREFERENCES,
        method: HTTP_METHODS.GET,
      }),
      providesTags: ['NotificationPreferences'],
    }),
    updateNotificationPreferences: builder.mutation<ApiResponse<NotificationPreferences>, Partial<NotificationPreferences>>({
      query: (body) => ({
        url: API_PATHS.NOTIFICATIONS.PREFERENCES,
        method: HTTP_METHODS.PUT,
        body,
      }),
      invalidatesTags: ['NotificationPreferences'],
    }),
    listNotificationTemplates: builder.query<ApiResponse<PaginatedCollection<NotificationTemplate>>, { page?: number; limit?: number; template_type?: string; salon_id?: string }>({
      query: (params) => ({
        url: API_PATHS.NOTIFICATIONS.TEMPLATES,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['NotificationTemplates'],
    }),
    createNotificationTemplate: builder.mutation<ApiResponse<NotificationTemplate>, TemplateCreateRequest>({
      query: (body) => ({
        url: API_PATHS.NOTIFICATIONS.TEMPLATES,
        method: HTTP_METHODS.POST,
        body,
      }),
      invalidatesTags: ['NotificationTemplates'],
    }),
    updateNotificationTemplate: builder.mutation<ApiResponse<NotificationTemplate>, { id: string; body: Partial<TemplateCreateRequest> }>({
      query: ({ id, body }) => ({
        url: API_PATHS.NOTIFICATIONS.TEMPLATE_DETAIL(id),
        method: HTTP_METHODS.PUT,
        body,
      }),
      invalidatesTags: ['NotificationTemplates'],
    }),
    deleteNotificationTemplate: builder.mutation<ApiResponse<{ id: string }>, string>({
      query: (id) => ({
        url: API_PATHS.NOTIFICATIONS.TEMPLATE_DETAIL(id),
        method: HTTP_METHODS.DELETE,
      }),
      invalidatesTags: ['NotificationTemplates'],
    }),
    cloneNotificationTemplate: builder.mutation<ApiResponse<NotificationTemplate>, string>({
      query: (id) => ({
        url: API_PATHS.NOTIFICATIONS.TEMPLATE_CLONE(id),
        method: HTTP_METHODS.POST,
      }),
      invalidatesTags: ['NotificationTemplates'],
    }),
    previewNotificationTemplate: builder.query<ApiResponse<{ subject: string; body: string }>, string>({
      query: (id) => ({
        url: API_PATHS.NOTIFICATIONS.TEMPLATE_PREVIEW(id),
        method: HTTP_METHODS.GET,
      }),
    }),
    listCommunicationCampaigns: builder.query<ApiResponse<PaginatedCollection<CommunicationCampaign>>, { page?: number; limit?: number; salon_id?: string }>({
      query: (params) => ({
        url: API_PATHS.NOTIFICATIONS.CAMPAIGNS,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['CommunicationCampaigns'],
    }),
    createCommunicationCampaign: builder.mutation<ApiResponse<CommunicationCampaign>, CampaignCreateRequest>({
      query: (body) => ({
        url: API_PATHS.NOTIFICATIONS.CAMPAIGNS,
        method: HTTP_METHODS.POST,
        body,
      }),
      invalidatesTags: ['CommunicationCampaigns', 'CommunicationLogs'],
    }),
    sendCommunicationCampaign: builder.mutation<ApiResponse<CommunicationCampaign>, string>({
      query: (id) => ({
        url: API_PATHS.NOTIFICATIONS.CAMPAIGN_SEND(id),
        method: HTTP_METHODS.POST,
      }),
      invalidatesTags: ['CommunicationCampaigns', 'CommunicationLogs'],
    }),
    listCommunicationLogs: builder.query<ApiResponse<PaginatedCollection<CommunicationLog>>, { page?: number; limit?: number; campaign_id?: string }>({
      query: (params) => ({
        url: API_PATHS.NOTIFICATIONS.LOGS,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['CommunicationLogs'],
    }),
    listBusinessAlerts: builder.query<ApiResponse<PaginatedCollection<BusinessAlert>>, { page?: number; limit?: number; salon_id?: string }>({
      query: (params) => ({
        url: API_PATHS.NOTIFICATIONS.BUSINESS_ALERTS,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['BusinessAlerts'],
    }),
    listSubscriptionNotifications: builder.query<ApiResponse<PaginatedCollection<BusinessAlert>>, { page?: number; limit?: number; salon_id?: string }>({
      query: (params) => ({
        url: API_PATHS.NOTIFICATIONS.SUBSCRIPTION_NOTIFICATIONS,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['BusinessAlerts'],
    }),
  }),
});

export const {
  useListNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkNotificationReadMutation,
  useMarkAllNotificationsReadMutation,
  useGetNotificationPreferencesQuery,
  useUpdateNotificationPreferencesMutation,
  useListNotificationTemplatesQuery,
  useCreateNotificationTemplateMutation,
  useUpdateNotificationTemplateMutation,
  useDeleteNotificationTemplateMutation,
  useCloneNotificationTemplateMutation,
  usePreviewNotificationTemplateQuery,
  useListCommunicationCampaignsQuery,
  useCreateCommunicationCampaignMutation,
  useSendCommunicationCampaignMutation,
  useListCommunicationLogsQuery,
  useListBusinessAlertsQuery,
  useListSubscriptionNotificationsQuery,
} = notificationsApi;
