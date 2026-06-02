import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import {
  CreateSalonProductRequest,
  MasterProductItem,
  SalonProductItem,
  SalonProductsQueryParams,
  UpdateSalonProductRequest,
} from './Types';

export const salonProductsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMasterProducts: builder.query<ApiResponse<MasterProductItem[]>, void>({
      query: () => ({
        url: API_PATHS.SALON_PRODUCTS.MASTER_LIST,
        method: HTTP_METHODS.GET,
      }),
      providesTags: ['MasterProducts'],
    }),
    getSalonProducts: builder.query<ApiResponse<SalonProductItem[]>, SalonProductsQueryParams | void>({
      query: (params) => ({
        url: API_PATHS.SALON_PRODUCTS.LIST,
        method: HTTP_METHODS.GET,
        params: params?.salon_id ? { salon_id: params.salon_id } : undefined,
      }),
      providesTags: ['SalonProducts'],
    }),
    createSalonProduct: builder.mutation<
      ApiResponse<SalonProductItem>,
      { body: CreateSalonProductRequest; salon_id?: string }
    >({
      query: ({ body, salon_id }) => ({
        url: API_PATHS.SALON_PRODUCTS.LIST,
        method: HTTP_METHODS.POST,
        params: salon_id ? { salon_id } : undefined,
        body,
      }),
      invalidatesTags: ['SalonProducts'],
    }),
    updateSalonProduct: builder.mutation<
      ApiResponse<SalonProductItem>,
      { id: string; body: UpdateSalonProductRequest; salon_id?: string }
    >({
      query: ({ id, body, salon_id }) => ({
        url: API_PATHS.SALON_PRODUCTS.DETAIL(id),
        method: HTTP_METHODS.PUT,
        params: salon_id ? { salon_id } : undefined,
        body,
      }),
      invalidatesTags: ['SalonProducts'],
    }),
    deleteSalonProduct: builder.mutation<
      ApiResponse<null>,
      { id: string; salon_id?: string }
    >({
      query: ({ id, salon_id }) => ({
        url: API_PATHS.SALON_PRODUCTS.DETAIL(id),
        method: HTTP_METHODS.DELETE,
        params: salon_id ? { salon_id } : undefined,
      }),
      invalidatesTags: ['SalonProducts'],
    }),
  }),
});

export const {
  useGetMasterProductsQuery,
  useGetSalonProductsQuery,
  useCreateSalonProductMutation,
  useUpdateSalonProductMutation,
  useDeleteSalonProductMutation,
} = salonProductsApi;
