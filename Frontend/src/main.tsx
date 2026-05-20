import { createRoot } from 'react-dom/client';

import './index.css';

import { StrictMode } from 'react';
import { Provider as StoreProvider } from 'react-redux';

import { ToastContainer } from './components/common/Toast/ToastContainer.tsx';
import { ThemeProvider } from './context/ThemeContext/index.tsx';
import { store } from './redux/store/index.ts';
import { AppRoutes } from './routes/AppRoutes.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider store={store}>
      <ToastContainer />
      <ThemeProvider>
        <AppRoutes />
      </ThemeProvider>
    </StoreProvider>
  </StrictMode>
);
