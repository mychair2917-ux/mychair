import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router';

import { ErrorBoundary } from './components/common';
import { Header, Sidebar } from './components/layout';
import ScrollToTop from './components/layout/ScrollToTop';
import { PUBLIC_ROUTES } from './constants';
import { useAppSelector } from './redux/hooks';

function App() {
  const location = useLocation();
  const token = useAppSelector((state) => state.auth.token);
  const isOpenRoute = !token || PUBLIC_ROUTES.includes(location.pathname);

  return (
    <div className="flex min-h-screen bg-[var(--color-surface-bg)] text-[var(--color-text-primary)] font-['Outfit']">
      <ScrollToTop />
      {!isOpenRoute && <Sidebar />}
      
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        {!isOpenRoute && <Header />}
        
        <main className={`flex-1 overflow-x-hidden overflow-y-auto custom-scrollbar ${isOpenRoute ? 'p-0' : 'bg-[var(--color-surface-bg)]'}`}>
          <Suspense fallback={<div className="flex h-full items-center justify-center p-8">Loading...</div>}>
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </Suspense>
        </main>
      </div>
    </div>
  );
}

export default App;
