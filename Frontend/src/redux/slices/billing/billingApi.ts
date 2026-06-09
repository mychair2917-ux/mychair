import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import { BillDetail, BillListParams, PaginatedBillData } from './Types';

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
  }),
});

export const { useListBillsQuery, useLazyGetBillDetailQuery } = billingApi;
