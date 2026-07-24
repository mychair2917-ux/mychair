import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import {
  AppointmentClient,
  AppointmentClientHistoryParams,
  AppointmentListItem,
  AppointmentProductOption,
  AppointmentSalonProductsParams,
  AppointmentSalonServicesParams,
  AppointmentListParams,
  AppointmentServiceOption,
  AppointmentStaffOption,
  BillByAppointmentParams,
  CreateAppointmentClientRequest,
  CreateFrontDeskAppointmentRequest,
  PaginatedAppointmentData,
  SearchClientsParams,
  TodayAppointmentsParams,
} from './Types';
import type { BillDetail } from '../billing/Types';

export const appointmentsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getTodayAppointments: builder.query<ApiResponse<AppointmentListItem[]>, TodayAppointmentsParams>({
      query: (params) => ({
        url: API_PATHS.APPOINTMENTS.TODAY,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['Appointments'],
    }),
    searchAppointmentClients: builder.query<ApiResponse<AppointmentClient[]>, SearchClientsParams>({
      query: (params) => ({
        url: API_PATHS.APPOINTMENTS.CLIENTS,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['AppointmentClients'],
    }),
    createAppointmentClient: builder.mutation<
      ApiResponse<AppointmentClient>,
      CreateAppointmentClientRequest
    >({
      query: (body) => ({
        url: API_PATHS.APPOINTMENTS.CLIENTS,
        method: HTTP_METHODS.POST,
        body,
      }),
      invalidatesTags: ['AppointmentClients'],
    }),
    getAppointmentClientHistory: builder.query<ApiResponse<AppointmentListItem[]>, AppointmentClientHistoryParams>({
      query: ({ id, salon_id }) => ({
        url: API_PATHS.APPOINTMENTS.CLIENT_HISTORY(id),
        method: HTTP_METHODS.GET,
        params: salon_id ? { salon_id } : undefined,
      }),
      providesTags: (_result, _error, { id }) => [{ type: 'Appointments', id }],
    }),
    getAppointmentSalonServices: builder.query<
      ApiResponse<AppointmentServiceOption[]>,
      AppointmentSalonServicesParams
    >({
      query: (params) => ({
        url: API_PATHS.APPOINTMENTS.SALON_SERVICES,
        method: HTTP_METHODS.GET,
        params,
      }),
    }),
    getAppointmentSalonProducts: builder.query<
      ApiResponse<AppointmentProductOption[]>,
      AppointmentSalonProductsParams
    >({
      query: (params) => ({
        url: API_PATHS.APPOINTMENTS.SALON_PRODUCTS,
        method: HTTP_METHODS.GET,
        params,
      }),
    }),
    getAppointmentStaff: builder.query<ApiResponse<AppointmentStaffOption[]>, void>({
      query: () => ({
        url: API_PATHS.APPOINTMENTS.STAFF,
        method: HTTP_METHODS.GET,
      }),
    }),
    createFrontDeskAppointment: builder.mutation<
      ApiResponse<AppointmentListItem>,
      CreateFrontDeskAppointmentRequest
    >({
      query: (body) => ({
        url: API_PATHS.APPOINTMENTS.CREATE_FRONTDESK,
        method: HTTP_METHODS.POST,
        body,
      }),
      invalidatesTags: ['Appointments'],
    }),
    listAppointments: builder.query<ApiResponse<PaginatedAppointmentData>, AppointmentListParams>({
      query: (params) => {
        const queryParams: Record<string, string | number> = {
          salon_id: params.salon_id,
        };
        if (params.page) queryParams.page = params.page;
        if (params.limit) queryParams.limit = params.limit;
        if (params.search) queryParams.search = params.search;
        if (params.status) queryParams.status = params.status;
        if (params.sort_by) queryParams.sort_by = params.sort_by;
        if (params.sort_order) queryParams.sort_order = params.sort_order;
        if (params.date_from) queryParams.date_from = params.date_from;
        if (params.date_to) queryParams.date_to = params.date_to;
        return {
          url: API_PATHS.APPOINTMENTS.LIST,
          method: HTTP_METHODS.GET,
          params: queryParams,
        };
      },
      providesTags: ['Appointments'],
    }),

    getBillByAppointment: builder.query<ApiResponse<BillDetail | null>, BillByAppointmentParams>({
      query: ({ salon_id, appointment_id }) => ({
        url: API_PATHS.BILLING.BILLS,
        method: HTTP_METHODS.GET,
        params: { salon_id, appointment_id, limit: 1 },
      }),
      transformResponse: (response: ApiResponse<{ items: BillDetail[] }>) => {
        const first = response?.data?.items?.[0] ?? null;
        return { ...response, data: first };
      },
    }),
  }),
});

export const {
  useGetTodayAppointmentsQuery,
  useLazySearchAppointmentClientsQuery,
  useCreateAppointmentClientMutation,
  useGetAppointmentClientHistoryQuery,
  useGetAppointmentSalonServicesQuery,
  useGetAppointmentSalonProductsQuery,
  useGetAppointmentStaffQuery,
  useCreateFrontDeskAppointmentMutation,
  useListAppointmentsQuery,
  useLazyGetBillByAppointmentQuery,
} = appointmentsApi;
