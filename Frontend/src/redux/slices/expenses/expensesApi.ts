import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import {
  CreateExpenseRequest,
  ExpenseItem,
  ExpenseListParams,
  LookupOption,
  PaginatedExpenseData,
  UpdateExpenseRequest,
} from './Types';

export const expensesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getExpenseCategories: builder.query<ApiResponse<LookupOption[]>, void>({
      query: () => ({
        url: API_PATHS.EXPENSES.CATEGORIES,
        method: HTTP_METHODS.GET,
      }),
      providesTags: ['Expenses'],
    }),
    getPaymentModes: builder.query<ApiResponse<LookupOption[]>, void>({
      query: () => ({
        url: API_PATHS.EXPENSES.PAYMENT_MODES,
        method: HTTP_METHODS.GET,
      }),
      providesTags: ['Expenses'],
    }),
    listExpenses: builder.query<ApiResponse<PaginatedExpenseData>, ExpenseListParams>({
      query: (params) => {
        const queryParams: Record<string, string | number> = {
          salon_id: params.salon_id,
        };
        if (params.page) queryParams.page = params.page;
        if (params.limit) queryParams.limit = params.limit;
        if (params.search) queryParams.search = params.search;
        if (params.sort_by) queryParams.sort_by = params.sort_by;
        if (params.sort_order) queryParams.sort_order = params.sort_order;
        if (params.category) queryParams.category = params.category;
        if (params.payment_mode) queryParams.payment_mode = params.payment_mode;
        if (params.branch_id) queryParams.branch_id = params.branch_id;
        return {
          url: API_PATHS.EXPENSES.LIST,
          method: HTTP_METHODS.GET,
          params: queryParams,
        };
      },
      providesTags: ['Expenses'],
    }),
    getExpense: builder.query<ApiResponse<ExpenseItem>, string>({
      query: (id) => ({
        url: API_PATHS.EXPENSES.DETAIL(id),
        method: HTTP_METHODS.GET,
      }),
      providesTags: (_result, _error, id) => [{ type: 'Expenses', id }],
    }),
    createExpense: builder.mutation<ApiResponse<ExpenseItem>, CreateExpenseRequest>({
      query: (body) => ({
        url: API_PATHS.EXPENSES.LIST,
        method: HTTP_METHODS.POST,
        body,
      }),
      invalidatesTags: ['Expenses'],
    }),
    updateExpense: builder.mutation<
      ApiResponse<ExpenseItem>,
      { id: string; body: UpdateExpenseRequest }
    >({
      query: ({ id, body }) => ({
        url: API_PATHS.EXPENSES.DETAIL(id),
        method: HTTP_METHODS.PUT,
        body,
      }),
      invalidatesTags: ['Expenses'],
    }),
    deleteExpense: builder.mutation<ApiResponse<{ deleted: boolean }>, string>({
      query: (id) => ({
        url: API_PATHS.EXPENSES.DETAIL(id),
        method: HTTP_METHODS.DELETE,
      }),
      invalidatesTags: ['Expenses'],
    }),
    uploadExpenseReceipt: builder.mutation<ApiResponse<ExpenseItem>, { id: string; file: File }>({
      query: ({ id, file }) => {
        const formData = new FormData();
        formData.append('receipt', file);
        return {
          url: API_PATHS.EXPENSES.RECEIPT(id),
          method: HTTP_METHODS.POST,
          body: formData,
        };
      },
      invalidatesTags: ['Expenses'],
    }),
  }),
});

export const {
  useGetExpenseCategoriesQuery,
  useGetPaymentModesQuery,
  useListExpensesQuery,
  useLazyGetExpenseQuery,
  useCreateExpenseMutation,
  useUpdateExpenseMutation,
  useDeleteExpenseMutation,
  useUploadExpenseReceiptMutation,
} = expensesApi;
