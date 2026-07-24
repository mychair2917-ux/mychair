import { HTTP_METHODS } from '../../../constants';
import { updateAuthUser } from '../auth/authSlice';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import {
  AvatarRemoveRequest,
  ChangePasswordRequest,
  ProfileData,
  ProfileResponse,
  UpdateProfileRequest,
} from './Types';

const mapProfileToAuthUser = (profile: ProfileData) => ({
  id: profile.id,
  email: profile.email,
  role: profile.role,
  first_name: profile.first_name ?? undefined,
  last_name: profile.last_name ?? undefined,
  phone: profile.phone ?? undefined,
  alternate_phone: profile.alternate_phone ?? undefined,
  avatar: profile.avatar ?? null,
  employee_id: profile.employee_id ?? undefined,
  employee_code: profile.employee_code ?? undefined,
  branch_name: profile.branch_name ?? undefined,
  branch_id: profile.branch_id ?? undefined,
  salon_name: profile.salon_name ?? undefined,
  department: profile.department ?? undefined,
  designation: profile.designation ?? undefined,
  shift: profile.shift ?? undefined,
  status: profile.status,
  joining_date: profile.joining_date ?? null,
  last_login: profile.last_login ?? null,
});

export const profileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getProfile: builder.query<ProfileResponse, void>({
      query: () => ({
        url: API_PATHS.PROFILE.GET,
        method: HTTP_METHODS.GET,
      }),
      providesTags: ['Profile'],
    }),
    updateProfile: builder.mutation<ProfileResponse, UpdateProfileRequest>({
      query: (body) => ({
        url: API_PATHS.PROFILE.UPDATE,
        method: HTTP_METHODS.PUT,
        body,
      }),
      invalidatesTags: ['Profile'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        if (data?.data) {
          dispatch(updateAuthUser(mapProfileToAuthUser(data.data)));
        }
      },
    }),
    changePassword: builder.mutation<ApiResponse<{ updated: boolean }>, ChangePasswordRequest>({
      query: (body) => ({
        url: API_PATHS.PROFILE.CHANGE_PASSWORD,
        method: HTTP_METHODS.PUT,
        body,
      }),
    }),
    uploadAvatar: builder.mutation<ProfileResponse, File>({
      query: (file) => {
        const formData = new FormData();
        formData.append('avatar', file);
        return {
          url: API_PATHS.PROFILE.AVATAR_UPLOAD,
          method: HTTP_METHODS.POST,
          body: formData,
        };
      },
      invalidatesTags: ['Profile'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        if (data?.data) {
          dispatch(updateAuthUser(mapProfileToAuthUser(data.data)));
        }
      },
    }),
    removeAvatar: builder.mutation<ProfileResponse, AvatarRemoveRequest>({
      query: (body) => ({
        url: API_PATHS.PROFILE.AVATAR_REMOVE,
        method: HTTP_METHODS.PUT,
        body,
      }),
      invalidatesTags: ['Profile'],
      async onQueryStarted(_, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        if (data?.data) {
          dispatch(updateAuthUser(mapProfileToAuthUser(data.data)));
        }
      },
    }),
  }),
});

export const {
  useGetProfileQuery,
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useUploadAvatarMutation,
  useRemoveAvatarMutation,
} = profileApi;
