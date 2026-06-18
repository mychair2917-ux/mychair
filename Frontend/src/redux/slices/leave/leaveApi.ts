import { HTTP_METHODS } from '../../../constants';
import { baseApi } from '../api/baseApi';
import { API_PATHS } from '../api/apiPaths';
import type { ApiResponse } from '../api/Types';
import type {
  LeaveApplyRequest,
  LeaveListParams,
  LeaveRejectRequest,
  LeaveRequestItem,
  PaginatedLeaveRequests,
} from './Types';

export const leaveApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    applyLeave: builder.mutation<ApiResponse<LeaveRequestItem>, LeaveApplyRequest>({
      query: (body) => ({
        url: API_PATHS.LEAVE.APPLY,
        method: HTTP_METHODS.POST,
        body,
      }),
      invalidatesTags: ['Leave', 'Dashboard'],
    }),
    listPendingLeave: builder.query<ApiResponse<PaginatedLeaveRequests>, LeaveListParams>({
      query: (params) => ({
        url: API_PATHS.LEAVE.PENDING,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['Leave'],
    }),
    listLeaveRequests: builder.query<ApiResponse<PaginatedLeaveRequests>, LeaveListParams>({
      query: (params) => ({
        url: API_PATHS.LEAVE.LIST,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['Leave'],
    }),
    approveLeave: builder.mutation<ApiResponse<LeaveRequestItem>, string>({
      query: (leaveId) => ({
        url: API_PATHS.LEAVE.APPROVE(leaveId),
        method: HTTP_METHODS.PATCH,
      }),
      invalidatesTags: ['Leave', 'Attendance', 'Dashboard'],
    }),
    rejectLeave: builder.mutation<
      ApiResponse<LeaveRequestItem>,
      { leaveId: string; body: LeaveRejectRequest }
    >({
      query: ({ leaveId, body }) => ({
        url: API_PATHS.LEAVE.REJECT(leaveId),
        method: HTTP_METHODS.PATCH,
        body,
      }),
      invalidatesTags: ['Leave', 'Attendance', 'Dashboard'],
    }),
  }),
});

export const {
  useApplyLeaveMutation,
  useListPendingLeaveQuery,
  useListLeaveRequestsQuery,
  useApproveLeaveMutation,
  useRejectLeaveMutation,
} = leaveApi;
