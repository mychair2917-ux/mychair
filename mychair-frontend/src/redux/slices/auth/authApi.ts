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
  GetLogOutUserParams,
  GetLogOutUserResponse,
  GoogleOAuthTokenResponse,
  LoginRequest,
  LoginResponse,
  ResetPasswordRequest,
  ResetPasswordResponse,
} from './Types';

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
    Fetches Google OAuth access token using authorization code.

    Parameters:
    @param oAuthCode - The authorization code received from Google's OAuth redirect.

    Returns:
    @returns GoogleOAuthTokenResponse - The access token and related info from Google.

    Exception Handling:
    Network or invalid code errors may occur; handle in component using mutation error states.
    */
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
    /**
    Logs in the user using a Google access token.

    Parameters:
    @param access_token - The access token obtained from Google OAuth.

    Returns:
    @returns LoginResponse - The backend response including user info and tokens.

    Exception Handling:
    API errors or invalid token may occur and should be handled in the component.
    */
    googleLogin: builder.mutation<LoginResponse, { access_token: string }>({
      query: ({ access_token }) => ({
        url: API_PATHS.AUTH.GOOGLE_OAUTH,
        method: HTTP_METHODS.POST,
        body: { access_token },
      }),
    }),
    /**
    Logs in the user using email and password credentials.

    Parameters:
    @param credentials - The login credentials including email and password.

    Returns:
    @returns LoginResponse - The backend response including user info and tokens.

    Exception Handling:
    Incorrect credentials or server errors may occur; handled via mutation status.
    */
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (credentials) => ({
        url: API_PATHS.AUTH.LOGIN,
        method: HTTP_METHODS.POST,
        body: credentials,
      }),
    }),
    /**
    Resets the user's password using a new password and token.

    Parameters:
    @param credentials - The reset password request body containing new password and reset token.

    Returns:
    @returns ResetPasswordResponse - A confirmation response from the backend.

    Exception Handling:
    Invalid/expired token or backend errors may occur and should be handled appropriately.
    */
    resetPassword: builder.mutation<ResetPasswordResponse, ResetPasswordRequest>({
      query: (credentials) => ({
        url: API_PATHS.AUTH.RESET_PASSWORD,
        method: HTTP_METHODS.POST,
        body: credentials,
      }),
    }),
    /**
    Logs out the user by invalidating their refresh token.
    
    Parameters:
    @param {object} params - The parameters for the logout request.
    @param {string} params.refresh_token - The refresh token to be invalidated.
    
    Returns:
    @returns {GetLogOutUserResponse} The response from the backend after a logout attempt.
    
    Exception Handling:
    Potential network errors or server-side issues may occur, leading to a failed logout.
    */
    logoutUser: builder.mutation<GetLogOutUserResponse, GetLogOutUserParams>({
      query: ({ refresh_token }) => ({
        url: API_PATHS.AUTH.LOGOUT_USER,
        method: HTTP_METHODS.POST,
        body: { refresh_token: refresh_token },
      }),
    }),
    /**
    Sends a request to initiate the password reset process by generating a reset link and emailing it to the user.

    Parameters:
    @param params - The request payload containing the user's email address.
    @param params.email - The email address associated with the account requesting a password reset.

    Returns:
    @returns {ResetPasswordResponse} - The server response indicating whether the reset link was sent successfully.

    Exception Handling:
    API errors are handled via RTK Query's built-in error handling mechanisms.
    */

    forgotPasswordLink: builder.mutation<ResetPasswordResponse, { email: string }>({
      query: ({ email }) => ({
        url: API_PATHS.AUTH.RESET_PASSWORD_LINK,
        method: HTTP_METHODS.POST,
        body: { email: email },
      }),
    }),
  }),
});

// React hooks for triggering authentication-related API mutations.
export const {
  useFetchGoogleAccessTokenMutation,
  useGoogleLoginMutation,
  useLoginMutation,
  useResetPasswordMutation,
  useLogoutUserMutation,
  useForgotPasswordLinkMutation,
} = authApi;
