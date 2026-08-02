import { HTTP_METHODS } from '../../../constants';
import {
  CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_TOKEN_URL,
  NAVIGATION_URL,
} from '../../../utils/config';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import {
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  GetLogOutUserParams,
  GetLogOutUserResponse,
  GoogleOAuthTokenResponse,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
  ResetPasswordSubmitRequest,
  ResetPasswordSubmitResponse,
  ValidateResetTokenResponse,
} from './Types';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    fetchGoogleAccessToken: builder.mutation<GoogleOAuthTokenResponse, { oAuthCode: string }>({
      query: ({ oAuthCode }) => ({
        url: GOOGLE_TOKEN_URL,
        method: HTTP_METHODS.POST,
        body: {
          grant_type: 'authorization_code',
          redirect_uri: `${NAVIGATION_URL}/login`,
          code: oAuthCode,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: CLIENT_SECRET,
        },
      }),
    }),
    googleLogin: builder.mutation<LoginResponse, { access_token: string }>({
      query: ({ access_token }) => ({
        url: API_PATHS.AUTH.GOOGLE_OAUTH,
        method: HTTP_METHODS.POST,
        body: { access_token },
      }),
    }),
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: API_PATHS.AUTH.LOGIN,
        method: HTTP_METHODS.POST,
        body: credentials,
      }),
    }),
    resetPassword: builder.mutation<ResetPasswordResponse, ResetPasswordRequest>({
      query: (credentials) => ({
        url: API_PATHS.AUTH.RESET_PASSWORD,
        method: HTTP_METHODS.POST,
        body: credentials,
      }),
    }),
    logoutUser: builder.mutation<GetLogOutUserResponse, GetLogOutUserParams>({
      query: ({ refresh_token }) => ({
        url: API_PATHS.AUTH.LOGOUT_USER,
        method: HTTP_METHODS.POST,
        body: { refresh_token: refresh_token },
      }),
    }),
    forgotPasswordLink: builder.mutation<ForgotPasswordResponse, ForgotPasswordRequest>({
      query: ({ email }) => ({
        url: API_PATHS.AUTH.RESET_PASSWORD_LINK,
        method: HTTP_METHODS.POST,
        body: { email },
      }),
    }),
    validateResetToken: builder.query<ValidateResetTokenResponse, string>({
      query: (token) => ({
        url: `${API_PATHS.AUTH.VALIDATE_RESET_TOKEN}?token=${encodeURIComponent(token)}`,
        method: HTTP_METHODS.GET,
      }),
    }),
    resetPasswordSubmit: builder.mutation<ResetPasswordSubmitResponse, ResetPasswordSubmitRequest>({
      query: (body) => ({
        url: API_PATHS.AUTH.RESET_PASSWORD,
        method: HTTP_METHODS.POST,
        body,
      }),
    }),
  }),
});

export const {
  useFetchGoogleAccessTokenMutation,
  useGoogleLoginMutation,
  useLoginMutation,
  useResetPasswordMutation,
  useLogoutUserMutation,
  useForgotPasswordLinkMutation,
  useValidateResetTokenQuery,
  useLazyValidateResetTokenQuery,
  useResetPasswordSubmitMutation,
} = authApi;

