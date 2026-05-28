import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import {
  AppointmentClient,
  AppointmentListItem,
  AppointmentListParams,
  AppointmentServiceOption,
  AppointmentStaffOption,
  CreateAppointmentClientRequest,
  CreateFrontDeskAppointmentRequest,
  PaginatedAppointmentData,
  SearchClientsParams,
  TodayAppointmentsParams,
} from './Types';

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
    getAppointmentClientHistory: builder.query<ApiResponse<AppointmentListItem[]>, string>({
      query: (id) => ({
        url: API_PATHS.APPOINTMENTS.CLIENT_HISTORY(id),
        method: HTTP_METHODS.GET,
      }),
      providesTags: (_result, _error, id) => [{ type: 'Appointments', id }],
    }),
    getAppointmentServices: builder.query<ApiResponse<AppointmentServiceOption[]>, void>({
      query: () => ({
        url: API_PATHS.APPOINTMENTS.SERVICES,
        method: HTTP_METHODS.GET,
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
  }),
});

export const {
  useGetTodayAppointmentsQuery,
  useLazySearchAppointmentClientsQuery,
  useCreateAppointmentClientMutation,
  useGetAppointmentClientHistoryQuery,
  useGetAppointmentServicesQuery,
  useGetAppointmentStaffQuery,
  useCreateFrontDeskAppointmentMutation,
  useListAppointmentsQuery,
} = appointmentsApi;
