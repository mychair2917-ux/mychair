import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import {
  CreateSalonServiceRequest,
  MasterServiceItem,
  SalonServiceItem,
  SalonServicesQueryParams,
  UpdateSalonServiceRequest,
} from './Types';

export const salonServicesApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getMasterServices: builder.query<ApiResponse<MasterServiceItem[]>, void>({
      query: () => ({
        url: API_PATHS.SALON_SERVICES.MASTER_LIST,
        method: HTTP_METHODS.GET,
      }),
      providesTags: ['MasterServices'],
    }),
    getSalonServices: builder.query<ApiResponse<SalonServiceItem[]>, SalonServicesQueryParams | void>({
      query: (params) => ({
        url: API_PATHS.SALON_SERVICES.LIST,
        method: HTTP_METHODS.GET,
        params: params?.salon_id ? { salon_id: params.salon_id } : undefined,
      }),
      providesTags: ['SalonServices'],
    }),
    createSalonService: builder.mutation<
      ApiResponse<SalonServiceItem>,
      { body: CreateSalonServiceRequest; salon_id?: string }
    >({
      query: ({ body, salon_id }) => ({
        url: API_PATHS.SALON_SERVICES.LIST,
        method: HTTP_METHODS.POST,
        params: salon_id ? { salon_id } : undefined,
        body,
      }),
      invalidatesTags: ['SalonServices'],
    }),
    updateSalonService: builder.mutation<
      ApiResponse<SalonServiceItem>,
      { id: string; body: UpdateSalonServiceRequest; salon_id?: string }
    >({
      query: ({ id, body, salon_id }) => ({
        url: API_PATHS.SALON_SERVICES.DETAIL(id),
        method: HTTP_METHODS.PUT,
        params: salon_id ? { salon_id } : undefined,
        body,
      }),
      invalidatesTags: ['SalonServices'],
    }),
    deleteSalonService: builder.mutation<
      ApiResponse<null>,
      { id: string; salon_id?: string }
    >({
      query: ({ id, salon_id }) => ({
        url: API_PATHS.SALON_SERVICES.DETAIL(id),
        method: HTTP_METHODS.DELETE,
        params: salon_id ? { salon_id } : undefined,
      }),
      invalidatesTags: ['SalonServices'],
    }),
  }),
});

export const {
  useGetMasterServicesQuery,
  useGetSalonServicesQuery,
  useCreateSalonServiceMutation,
  useUpdateSalonServiceMutation,
  useDeleteSalonServiceMutation,
} = salonServicesApi;
