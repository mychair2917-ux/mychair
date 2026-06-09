import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import {
  MonthlyPayrollParams,
  PaginatedPayrollHistory,
  PayrollBreakdown,
  PayrollHistoryParams,
  PayrollItem,
  SalarySlip,
  SalaryStructureItem,
  SalaryStructureUpdateRequest,
} from './Types';

export const payrollApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listSalaryStructure: builder.query<ApiResponse<SalaryStructureItem[]>, void>({
      query: () => ({
        url: API_PATHS.PAYROLL.SALARY_STRUCTURE,
        method: HTTP_METHODS.GET,
      }),
      providesTags: ['SalaryStructure'],
    }),
    updateSalaryStructure: builder.mutation<
      ApiResponse<SalaryStructureItem>,
      { employeeId: string; body: SalaryStructureUpdateRequest }
    >({
      query: ({ employeeId, body }) => ({
        url: API_PATHS.PAYROLL.SALARY_STRUCTURE_DETAIL(employeeId),
        method: HTTP_METHODS.PATCH,
        body,
      }),
      invalidatesTags: ['SalaryStructure'],
    }),
    listMonthlyPayroll: builder.query<ApiResponse<PayrollItem[]>, MonthlyPayrollParams>({
      query: ({ month, year }) => ({
        url: API_PATHS.PAYROLL.LIST,
        method: HTTP_METHODS.GET,
        params: { month, year },
      }),
      providesTags: ['Payroll'],
    }),
    generatePayroll: builder.mutation<ApiResponse<PayrollItem[]>, MonthlyPayrollParams>({
      query: (body) => ({
        url: API_PATHS.PAYROLL.GENERATE,
        method: HTTP_METHODS.POST,
        body,
      }),
      invalidatesTags: ['Payroll', 'PayrollHistory'],
    }),
    markPayrollPaid: builder.mutation<ApiResponse<PayrollItem>, string>({
      query: (id) => ({
        url: API_PATHS.PAYROLL.PAY(id),
        method: HTTP_METHODS.PATCH,
      }),
      invalidatesTags: ['Payroll', 'PayrollHistory'],
    }),
    getPayrollBreakdown: builder.query<ApiResponse<PayrollBreakdown>, string>({
      query: (id) => ({
        url: API_PATHS.PAYROLL.DETAIL(id),
        method: HTTP_METHODS.GET,
      }),
    }),
    getSalarySlip: builder.query<ApiResponse<SalarySlip>, string>({
      query: (id) => ({
        url: API_PATHS.PAYROLL.SLIP(id),
        method: HTTP_METHODS.GET,
      }),
    }),
    listSalaryHistory: builder.query<
      ApiResponse<PaginatedPayrollHistory>,
      PayrollHistoryParams
    >({
      query: (params) => {
        const queryParams: Record<string, string | number> = {};
        if (params.month) queryParams.month = params.month;
        if (params.year) queryParams.year = params.year;
        if (params.employee_id) queryParams.employee_id = params.employee_id;
        if (params.payment_status) queryParams.payment_status = params.payment_status;
        if (params.page) queryParams.page = params.page;
        if (params.limit) queryParams.limit = params.limit;
        if (params.sort_by) queryParams.sort_by = params.sort_by;
        if (params.sort_order) queryParams.sort_order = params.sort_order;
        return {
          url: API_PATHS.PAYROLL.HISTORY,
          method: HTTP_METHODS.GET,
          params: queryParams,
        };
      },
      providesTags: ['PayrollHistory'],
    }),
  }),
});

export const {
  useListSalaryStructureQuery,
  useUpdateSalaryStructureMutation,
  useListMonthlyPayrollQuery,
  useGeneratePayrollMutation,
  useMarkPayrollPaidMutation,
  useLazyGetPayrollBreakdownQuery,
  useLazyGetSalarySlipQuery,
  useListSalaryHistoryQuery,
} = payrollApi;
