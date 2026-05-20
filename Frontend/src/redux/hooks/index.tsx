// Redux hooks with TypeScript support
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

import type { AppDispatch, RootState } from '../store';

// Typed dispatch hook
export const useAppDispatch: () => AppDispatch = useDispatch;

// Typed selector hook
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
