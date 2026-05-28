import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

import apiStateReducer from '../slices/api/apiStatusSlice';
import { baseApi } from '../slices/api/baseApi';
import authReducer from '../slices/auth/authSlice';
import '../slices/invitations/invitationsApi';
import '../slices/salonOwner/salonOwnerApi';
import '../slices/employees/employeesApi';
import '../slices/appointments/appointmentsApi';

export const store = configureStore({
  reducer: {
    [baseApi.reducerPath]: baseApi.reducer,
    auth: authReducer,
    apiStatus: apiStateReducer,
  },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(baseApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
