import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import {
  BillDetail,
  BillListParams,
  BulkBillingBatchSummary,
  EditBulkRowPayload,
  PaginatedBillData,
  PaginatedBulkBatches,
} from './Types';

export const billingApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    listBills: builder.query<ApiResponse<PaginatedBillData>, BillListParams>({
      query: (params) => {
        const queryParams: Record<string, string | number> = {
          salon_id: params.salon_id,
        };
        if (params.page) queryParams.page = params.page;
        if (params.limit) queryParams.limit = params.limit;
        if (params.payment_status) queryParams.payment_status = params.payment_status;
        if (params.bill_status) queryParams.bill_status = params.bill_status;
        if (params.payment_method) queryParams.payment_method = params.payment_method;
        if (params.staff_id) queryParams.staff_id = params.staff_id;
        if (params.staff_name) queryParams.staff_name = params.staff_name;
        if (params.branch_id) queryParams.branch_id = params.branch_id;
        if (params.startDate) queryParams.startDate = params.startDate;
        if (params.endDate) queryParams.endDate = params.endDate;
        if (params.search) queryParams.search = params.search;
        return {
          url: API_PATHS.BILLING.BILLS,
          method: HTTP_METHODS.GET,
          params: queryParams,
        };
      },
      providesTags: ['Bills'],
    }),
    getBillDetail: builder.query<ApiResponse<BillDetail>, string>({
      query: (billId) => ({
        url: API_PATHS.BILLING.BILL_DETAIL(billId),
        method: HTTP_METHODS.GET,
      }),
      providesTags: (_result, _error, billId) => [{ type: 'Bills', id: billId }],
    }),
    validateBulkUpload: builder.mutation<ApiResponse<BulkBillingBatchSummary>, FormData>({
      query: (formData) => ({
        url: API_PATHS.BILLING.BULK_VALIDATE,
        method: HTTP_METHODS.POST,
        body: formData,
      }),
    }),
    confirmBulkUpload: builder.mutation<
      ApiResponse<BulkBillingBatchSummary>,
      {
        batch_id: string;
        salon_id: string;
        staff_mappings?: Record<string, string>;
        deduct_inventory?: boolean;
      }
    >({
      query: (payload) => ({
        url: API_PATHS.BILLING.BULK_CONFIRM,
        method: HTTP_METHODS.POST,
        body: payload,
      }),
      invalidatesTags: ['Bills', 'Appointments'],
    }),
    listBulkBatches: builder.query<
      ApiResponse<PaginatedBulkBatches>,
      { salon_id: string; page?: number; limit?: number }
    >({
      query: ({ salon_id, page = 1, limit = 10 }) => ({
        url: API_PATHS.BILLING.BULK_BATCHES,
        method: HTTP_METHODS.GET,
        params: { salon_id, page, limit },
      }),
    }),
    getBulkBatchDetail: builder.query<
      ApiResponse<BulkBillingBatchSummary>,
      { batch_id: string; salon_id: string }
    >({
      query: ({ batch_id, salon_id }) => ({
        url: API_PATHS.BILLING.BULK_BATCH_DETAIL(batch_id),
        method: HTTP_METHODS.GET,
        params: { salon_id },
      }),
    }),
    downloadServiceTemplate: builder.query<Blob, { salon_id?: string } | void>({
      query: (arg) => ({
        url: API_PATHS.BILLING.BULK_TEMPLATE_SERVICE,
        method: HTTP_METHODS.GET,
        params: arg?.salon_id ? { salon_id: arg.salon_id } : undefined,
        responseHandler: (response: Response) => response.blob(),
      }),
    }),
    downloadProductTemplate: builder.query<Blob, { salon_id?: string } | void>({
      query: (arg) => ({
        url: API_PATHS.BILLING.BULK_TEMPLATE_PRODUCT,
        method: HTTP_METHODS.GET,
        params: arg?.salon_id ? { salon_id: arg.salon_id } : undefined,
        responseHandler: (response: Response) => response.blob(),
      }),
    }),
    downloadFailedRecords: builder.query<Blob, { batch_id: string; salon_id: string }>({
      query: ({ batch_id, salon_id }) => ({
        url: API_PATHS.BILLING.BULK_FAILED_RECORDS(batch_id),
        method: HTTP_METHODS.GET,
        params: { salon_id },
        responseHandler: (response: Response) => response.blob(),
      }),
    }),
    downloadBatchSummary: builder.query<Blob, { batch_id: string; salon_id: string }>({
      query: ({ batch_id, salon_id }) => ({
        url: API_PATHS.BILLING.BULK_SUMMARY(batch_id),
        method: HTTP_METHODS.GET,
        params: { salon_id },
        responseHandler: (response: Response) => response.blob(),
      }),
    }),
    downloadGeneratedClientIds: builder.query<Blob, { batch_id: string; salon_id: string }>({
      query: ({ batch_id, salon_id }) => ({
        url: API_PATHS.BILLING.BULK_GENERATED_CLIENT_IDS(batch_id),
        method: HTTP_METHODS.GET,
        params: { salon_id },
        responseHandler: (response: Response) => response.blob(),
      }),
    }),
    editBulkRow: builder.mutation<
      ApiResponse<BulkBillingBatchSummary>,
      { batch_id: string; excel_row: number; salon_id: string; data: EditBulkRowPayload }
    >({
      query: ({ batch_id, excel_row, salon_id, data }) => ({
        url: API_PATHS.BILLING.BULK_EDIT_ROW(batch_id, excel_row),
        method: HTTP_METHODS.PUT,
        params: { salon_id },
        body: data,
      }),
    }),
  }),
});

export const {
  useListBillsQuery,
  useLazyGetBillDetailQuery,
  useValidateBulkUploadMutation,
  useConfirmBulkUploadMutation,
  useListBulkBatchesQuery,
  useGetBulkBatchDetailQuery,
  useLazyDownloadServiceTemplateQuery,
  useLazyDownloadProductTemplateQuery,
  useLazyDownloadFailedRecordsQuery,
  useLazyDownloadBatchSummaryQuery,
  useLazyDownloadGeneratedClientIdsQuery,
  useEditBulkRowMutation,
} = billingApi;


