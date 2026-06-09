import { HTTP_METHODS } from '../../../constants';
import { API_PATHS } from '../api/apiPaths';
import { baseApi } from '../api/baseApi';
import { ApiResponse } from '../api/Types';
import { SalonListItem } from './Types';

export const salonsApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getSalonsList: builder.query<ApiResponse<SalonListItem[]>, void>({
      query: () => ({
        url: API_PATHS.SALONS.LIST,
        method: HTTP_METHODS.GET,
      }),
    }),
  }),
});

export const { useGetSalonsListQuery } = salonsApi;
