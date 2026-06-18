import { HTTP_METHODS } from '../../../constants';
import { baseApi } from '../api/baseApi';
import { API_PATHS } from '../api/apiPaths';
import type { ApiResponse } from '../api/Types';

export interface TodayAttendanceStatus {
  attendance_date: string;
  shift_timing?: string | null;
  status?: string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  total_work_minutes: number;
  total_hours: number;
  can_check_in: boolean;
  can_check_out: boolean;
  is_checked_in: boolean;
  is_checked_out: boolean;
  location_required: boolean;
  branch_configured: boolean;
}

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  employee_name: string;
  branch_id?: string | null;
  branch_name?: string | null;
  attendance_date: string;
  check_in_time?: string | null;
  check_out_time?: string | null;
  status: string;
  late_minutes: number;
  total_work_minutes: number;
  total_hours: number;
  attendance_method: string;
  notes?: string | null;
}

export interface PaginatedAttendance {
  items: AttendanceRecord[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface BranchLocation {
  branch_id?: string | null;
  branch_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  attendance_radius: number;
  shift_start: string;
  is_configured: boolean;
}

export interface LocationPayload {
  latitude: number;
  longitude: number;
}

export interface BranchLocationUpdate extends LocationPayload {
  attendance_radius: number;
  branch_id?: string | null;
  shift_start?: string;
}

export interface ManualAttendanceUpdate {
  attendance_id: string;
  status?: string;
  check_in_time?: string;
  check_out_time?: string;
  notes?: string;
}

export interface AttendanceSummary {
  present_count: number;
  late_count: number;
  absent_count: number;
  leave_count: number;
  week_off_count: number;
  half_day_count: number;
  total_records: number;
  total_work_hours: number;
}

export interface AttendanceListParams {
  page?: number;
  limit?: number;
  search?: string;
  date_from?: string;
  date_to?: string;
  branch_id?: string;
  salon_id?: string;
  employee_id?: string;
}

export const attendanceApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAttendanceSummary: builder.query<ApiResponse<AttendanceSummary>, AttendanceListParams>({
      query: (params) => ({
        url: API_PATHS.ATTENDANCE.SUMMARY,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['Attendance'],
    }),
    getTodayAttendanceStatus: builder.query<ApiResponse<TodayAttendanceStatus>, void>({
      query: () => ({
        url: API_PATHS.ATTENDANCE.TODAY_STATUS,
        method: HTTP_METHODS.GET,
      }),
      providesTags: ['Attendance'],
    }),
    checkIn: builder.mutation<ApiResponse<AttendanceRecord>, LocationPayload>({
      query: (body) => ({
        url: API_PATHS.ATTENDANCE.CHECK_IN,
        method: HTTP_METHODS.POST,
        body,
      }),
      invalidatesTags: ['Attendance'],
    }),
    checkOut: builder.mutation<ApiResponse<AttendanceRecord>, LocationPayload>({
      query: (body) => ({
        url: API_PATHS.ATTENDANCE.CHECK_OUT,
        method: HTTP_METHODS.POST,
        body,
      }),
      invalidatesTags: ['Attendance'],
    }),
    listMyAttendance: builder.query<ApiResponse<PaginatedAttendance>, AttendanceListParams>({
      query: (params) => ({
        url: API_PATHS.ATTENDANCE.MY,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['Attendance'],
    }),
    listBranchAttendance: builder.query<ApiResponse<PaginatedAttendance>, AttendanceListParams>({
      query: (params) => ({
        url: API_PATHS.ATTENDANCE.BRANCH,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['Attendance'],
    }),
    listAllAttendance: builder.query<ApiResponse<PaginatedAttendance>, AttendanceListParams>({
      query: (params) => ({
        url: API_PATHS.ATTENDANCE.ALL,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['Attendance'],
    }),
    manualUpdateAttendance: builder.mutation<ApiResponse<AttendanceRecord>, ManualAttendanceUpdate>({
      query: (body) => ({
        url: API_PATHS.ATTENDANCE.MANUAL_UPDATE,
        method: HTTP_METHODS.PATCH,
        body,
      }),
      invalidatesTags: ['Attendance'],
    }),
    getBranchLocation: builder.query<ApiResponse<BranchLocation>, void>({
      query: () => ({
        url: API_PATHS.ATTENDANCE.BRANCH_LOCATION,
        method: HTTP_METHODS.GET,
      }),
      providesTags: ['BranchLocation'],
    }),
    updateBranchLocation: builder.mutation<ApiResponse<BranchLocation>, BranchLocationUpdate>({
      query: (body) => ({
        url: API_PATHS.ATTENDANCE.BRANCH_LOCATION,
        method: HTTP_METHODS.PATCH,
        body,
      }),
      invalidatesTags: ['BranchLocation', 'Attendance'],
    }),
  }),
});

export const {
  useGetAttendanceSummaryQuery,
  useGetTodayAttendanceStatusQuery,
  useCheckInMutation,
  useCheckOutMutation,
  useListMyAttendanceQuery,
  useListBranchAttendanceQuery,
  useListAllAttendanceQuery,
  useManualUpdateAttendanceMutation,
  useGetBranchLocationQuery,
  useUpdateBranchLocationMutation,
} = attendanceApi;
