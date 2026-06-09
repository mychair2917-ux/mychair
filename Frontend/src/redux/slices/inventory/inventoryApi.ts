import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import {
  InventoryOverview,
  InventoryPurchaseRequest,
  InventoryQueryParams,
  InventoryReports,
  InventoryStockItem,
  InventoryUseRequest,
} from './Types';

export const inventoryApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getInventoryOverview: builder.query<ApiResponse<InventoryOverview>, { salon_id: string }>({
      query: (params) => ({
        url: API_PATHS.INVENTORY.OVERVIEW,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['Inventory'],
    }),
    getInventoryStocks: builder.query<ApiResponse<InventoryStockItem[]>, InventoryQueryParams>({
      query: (params) => ({
        url: API_PATHS.INVENTORY.STOCKS,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['Inventory'],
    }),
    createInventoryPurchase: builder.mutation<
      ApiResponse<InventoryStockItem>,
      { salon_id: string; body: InventoryPurchaseRequest }
    >({
      query: ({ salon_id, body }) => ({
        url: API_PATHS.INVENTORY.PURCHASE,
        method: HTTP_METHODS.POST,
        params: { salon_id },
        body,
      }),
      invalidatesTags: ['Inventory', 'SalonProducts', 'Brands'],
    }),
    createInventoryUse: builder.mutation<
      ApiResponse<InventoryStockItem>,
      { salon_id: string; body: InventoryUseRequest }
    >({
      query: ({ salon_id, body }) => ({
        url: API_PATHS.INVENTORY.USE,
        method: HTTP_METHODS.POST,
        params: { salon_id },
        body,
      }),
      invalidatesTags: ['Inventory'],
    }),
    getInventoryReports: builder.query<ApiResponse<InventoryReports>, InventoryQueryParams>({
      query: (params) => ({
        url: API_PATHS.INVENTORY.REPORTS,
        method: HTTP_METHODS.GET,
        params,
      }),
      providesTags: ['Inventory'],
    }),
  }),
});

export const {
  useGetInventoryOverviewQuery,
  useGetInventoryStocksQuery,
  useCreateInventoryPurchaseMutation,
  useCreateInventoryUseMutation,
  useGetInventoryReportsQuery,
} = inventoryApi;
