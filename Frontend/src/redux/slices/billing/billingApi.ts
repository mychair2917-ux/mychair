import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import { BillListItem, BillListParams, PaginatedBillData } from './Types';

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
        if (params.search) queryParams.search = params.search;
        return {
          url: API_PATHS.BILLING.BILLS,
          method: HTTP_METHODS.GET,
          params: queryParams,
        };
      },
      providesTags: ['Bills'],
    }),
  }),
});

export const { useListBillsQuery } = billingApi;
