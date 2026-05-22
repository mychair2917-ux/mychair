import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import {
  CreateInvitationRequest,
  CreateInvitationResponseData,
  CreatePasswordRequest,
  CreatePasswordResponseData,
  ValidateInvitationResponseData,
} from './Types';

export const invitationsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    createInvitation: builder.mutation<
      ApiResponse<CreateInvitationResponseData>,
      CreateInvitationRequest
    >({
      query: (body) => ({
        url: API_PATHS.INVITATIONS.CREATE,
        method: HTTP_METHODS.POST,
        body,
      }),
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
  }),
});

export const {
  useCreateInvitationMutation,
  useValidateInvitationQuery,
  useCreatePasswordMutation,
} = invitationsApi;
