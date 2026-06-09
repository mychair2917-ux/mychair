import { HTTP_METHODS } from '../../../constants';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';

export interface PermissionRegistryItem {
  key: string;
  label: string;
  group?: string;
  children?: { key: string; label: string }[];
}

export interface RolePermissionsData {
  role: string;
  defaults: Record<string, boolean>;
  overrides: Record<string, boolean>;
  effective: Record<string, boolean>;
}

export interface UserPermissionsData {
  user_id: string;
  role: string;
  defaults: Record<string, boolean>;
  overrides: Record<string, boolean>;
  effective: Record<string, boolean>;
}

export interface FinalPermissionsData {
  role: string;
  permissions: Record<string, boolean>;
}

export const permissionsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPermissionRegistry: builder.query<ApiResponse<PermissionRegistryItem[]>, void>({
      query: () => ({
        url: '/permissions/registry',
        method: HTTP_METHODS.GET,
      }),
      providesTags: ['Permissions'],
    }),
    getMyPermissions: builder.query<ApiResponse<FinalPermissionsData>, void>({
      query: () => ({
        url: '/permissions/me',
        method: HTTP_METHODS.GET,
      }),
      providesTags: ['Permissions'],
    }),
    getRolePermissions: builder.query<ApiResponse<RolePermissionsData>, string>({
      query: (role) => ({
        url: `/permissions/roles/${role}`,
        method: HTTP_METHODS.GET,
      }),
      providesTags: (_r, _e, role) => [{ type: 'Permissions', id: `role-${role}` }],
    }),
    updateRolePermissions: builder.mutation<
      ApiResponse<{ role: string; effective: Record<string, boolean> }>,
      { role: string; permissions: Record<string, boolean> }
    >({
      query: ({ role, permissions }) => ({
        url: `/permissions/roles/${role}`,
        method: HTTP_METHODS.PUT,
        body: { permissions },
      }),
      invalidatesTags: (_r, _e, { role }) => [
        { type: 'Permissions', id: `role-${role}` },
        'Permissions',
      ],
    }),
    getUserPermissions: builder.query<ApiResponse<UserPermissionsData>, string>({
      query: (userId) => ({
        url: `/permissions/users/${userId}`,
        method: HTTP_METHODS.GET,
      }),
      providesTags: (_r, _e, userId) => [{ type: 'Permissions', id: `user-${userId}` }],
    }),
    updateUserPermissions: builder.mutation<
      ApiResponse<{ user_id: string; effective: Record<string, boolean> }>,
      { userId: string; permissions: Record<string, boolean> }
    >({
      query: ({ userId, permissions }) => ({
        url: `/permissions/users/${userId}`,
        method: HTTP_METHODS.PUT,
        body: { permissions },
      }),
      invalidatesTags: (_r, _e, { userId }) => [
        { type: 'Permissions', id: `user-${userId}` },
        'Permissions',
      ],
    }),
  }),
});

export const {
  useGetPermissionRegistryQuery,
  useGetMyPermissionsQuery,
  useGetRolePermissionsQuery,
  useUpdateRolePermissionsMutation,
  useGetUserPermissionsQuery,
  useUpdateUserPermissionsMutation,
} = permissionsApi;
