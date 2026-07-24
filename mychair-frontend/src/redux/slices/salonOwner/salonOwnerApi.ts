import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import {
  SalonOwnerLoginRequest,
  SalonOwnerLoginResponseData,
  SalonOwnerProfileData,
} from './Types';

export const salonOwnerApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    salonOwnerLogin: builder.mutation<
      ApiResponse<SalonOwnerLoginResponseData>,
      SalonOwnerLoginRequest
    >({
      query: (body) => ({
        url: API_PATHS.AUTH.SALON_OWNER_LOGIN,
        method: HTTP_METHODS.POST,
        body,
      }),
    }),
    getSalonOwnerProfile: builder.query<ApiResponse<SalonOwnerProfileData>, void>({
      query: () => ({
        url: API_PATHS.SALON_OWNER.PROFILE,
        method: HTTP_METHODS.GET,
      }),
    }),
  }),
});

export const { useSalonOwnerLoginMutation, useGetSalonOwnerProfileQuery } = salonOwnerApi;
