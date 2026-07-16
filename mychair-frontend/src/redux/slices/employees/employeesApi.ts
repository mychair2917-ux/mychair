import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import {
  EmployeeListItem,
  EmployeeResetPasswordRequest,
  EmployeeStatusRequest,
  EmployeeUpdateRequest,
  ListEmployeesParams,
} from './Types';

export const employeesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listEmployees: builder.query<ApiResponse<EmployeeListItem[]>, ListEmployeesParams | void>({
      query: (params) => ({
        url: API_PATHS.EMPLOYEES.LIST,
        method: HTTP_METHODS.GET,
        params: params ?? undefined,
      }),
      providesTags: ['Employees'],
    }),
    getEmployee: builder.query<ApiResponse<EmployeeListItem>, string>({
      query: (id) => ({
        url: API_PATHS.EMPLOYEES.DETAIL(id),
        method: HTTP_METHODS.GET,
      }),
      providesTags: (_r, _e, id) => [{ type: 'Employees', id }],
    }),
    updateEmployee: builder.mutation<
      ApiResponse<EmployeeListItem>,
      { id: string; body: EmployeeUpdateRequest }
    >({
      query: ({ id, body }) => ({
        url: API_PATHS.EMPLOYEES.DETAIL(id),
        method: HTTP_METHODS.PATCH,
        body,
      }),
      invalidatesTags: ['Employees'],
    }),
    updateEmployeeStatus: builder.mutation<
      ApiResponse<EmployeeListItem>,
      { id: string; body: EmployeeStatusRequest }
    >({
      query: ({ id, body }) => ({
        url: API_PATHS.EMPLOYEES.STATUS(id),
        method: HTTP_METHODS.PATCH,
        body,
      }),
      invalidatesTags: ['Employees'],
    }),
    resetEmployeePassword: builder.mutation<
      ApiResponse<{ id: string; email: string }>,
      { id: string; body: EmployeeResetPasswordRequest }
    >({
      query: ({ id, body }) => ({
        url: API_PATHS.EMPLOYEES.RESET_PASSWORD(id),
        method: HTTP_METHODS.POST,
        body,
      }),
    }),
  }),
});

export const {
  useListEmployeesQuery,
  useGetEmployeeQuery,
  useUpdateEmployeeMutation,
  useUpdateEmployeeStatusMutation,
  useResetEmployeePasswordMutation,
} = employeesApi;
