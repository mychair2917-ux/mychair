import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface ApiStatusState {
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
}

const initialState: ApiStatusState = {
  loading: {},
  errors: {},
};

const apiStatusSlice = createSlice({
  name: 'apiStatus',
  initialState,
  reducers: {
    setApiLoading: (state, action: PayloadAction<{ key: string; isLoading: boolean }>) => {
      state.loading[action.payload.key] = action.payload.isLoading;
    },
    setApiError: (state, action: PayloadAction<{ key: string; error: string | null }>) => {
      state.errors[action.payload.key] = action.payload.error;
    },
  },
});

export const { setApiLoading, setApiError } = apiStatusSlice.actions;
export default apiStatusSlice.reducer;
