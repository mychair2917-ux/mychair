import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import {
  CancelInviteRequest,
  CreateInviteRequest,
  CreateInvitationResponseData,
  CreatePasswordRequest,
  CreatePasswordResponseData,
  InvitationFormOptionsData,
  InviteListItem,
  ResendInviteRequest,
  ValidateInvitationResponseData,
} from './Types';

export const invitationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInvitationFormOptions: builder.query<ApiResponse<InvitationFormOptionsData>, void>({
      query: () => ({
        url: API_PATHS.INVITATIONS.FORM_OPTIONS,
        method: HTTP_METHODS.GET,
      }),
    }),
    listInvites: builder.query<
      ApiResponse<InviteListItem[]>,
      { status?: string } | void
    >({
      query: (params) => ({
        url: API_PATHS.INVITATIONS.LIST,
        method: HTTP_METHODS.GET,
        params: params?.status ? { status: params.status } : undefined,
      }),
      providesTags: ['Invites'],
    }),
    createInvitation: builder.mutation<
      ApiResponse<CreateInvitationResponseData>,
      CreateInviteRequest
    >({
      query: (body) => ({
        url: API_PATHS.INVITATIONS.CREATE,
        method: HTTP_METHODS.POST,
        body,
      }),
      invalidatesTags: ['Invites'],
    }),
    resendInvitation: builder.mutation<
      ApiResponse<{ id: string; resend_count: number }>,
      ResendInviteRequest
    >({
      query: (body) => ({
        url: API_PATHS.INVITATIONS.RESEND,
        method: HTTP_METHODS.POST,
        body,
      }),
      invalidatesTags: ['Invites'],
    }),
    cancelInvitation: builder.mutation<
      ApiResponse<{ id: string; status: string }>,
      CancelInviteRequest
    >({
      query: (body) => ({
        url: API_PATHS.INVITATIONS.CANCEL,
        method: HTTP_METHODS.POST,
        body,
      }),
      invalidatesTags: ['Invites'],
    }),
    validateInvitation: builder.query<
      ApiResponse<ValidateInvitationResponseData>,
      string
    >({
      query: (token) => ({
        url: API_PATHS.INVITATIONS.VALIDATE(token),
        method: HTTP_METHODS.GET,
      }),
    }),
    createPassword: builder.mutation<
      ApiResponse<CreatePasswordResponseData>,
      CreatePasswordRequest
    >({
      query: (body) => ({
        url: API_PATHS.INVITATIONS.CREATE_PASSWORD,
        method: HTTP_METHODS.POST,
        body,
      }),
    }),
    acceptInvitation: builder.mutation<
      ApiResponse<CreatePasswordResponseData>,
      CreatePasswordRequest
    >({
      query: (body) => ({
        url: API_PATHS.INVITATIONS.ACCEPT,
        method: HTTP_METHODS.POST,
        body,
      }),
    }),
  }),
});

export const {
  useGetInvitationFormOptionsQuery,
  useListInvitesQuery,
  useCreateInvitationMutation,
  useResendInvitationMutation,
  useCancelInvitationMutation,
  useValidateInvitationQuery,
  useCreatePasswordMutation,
  useAcceptInvitationMutation,
} = invitationsApi;
