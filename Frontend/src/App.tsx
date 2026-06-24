import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router';

import { ErrorBoundary } from './components/common';
import PermissionsBootstrap from './components/permissions/PermissionsBootstrap';
import NotificationRealtimeBridge from './components/notifications/NotificationRealtimeBridge';
import SubscriptionExpiryBanner from './components/subscription/SubscriptionExpiryBanner';
import SubscriptionGuard from './components/subscription/SubscriptionGuard';
import { Header, Sidebar } from './components/layout';
import ScrollToTop from './components/layout/ScrollToTop';
import { isSuperAdmin, isTenantScopedRole } from './config/rbac';
import { PUBLIC_ROUTES, ROUTE_PATHS } from './constants';
import { useAppSelector } from './redux/hooks';

function App() {
  const location = useLocation();
  const token = useAppSelector((state) => state.auth.token);
  const user = useAppSelector((state) => state.auth.user);
  const isPublicRoute = PUBLIC_ROUTES.includes(location.pathname);
  const isOpenRoute = !token || isPublicRoute;
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isOrgRoute = location.pathname.startsWith('/orgs/');
  const isSalonOwnerInviteRoute = location.pathname === `/${ROUTE_PATHS.SALON_INVITE}`;
  const isSubscriptionExpiredRoute = location.pathname === `/${ROUTE_PATHS.SUBSCRIPTION_EXPIRED}`;
  const showLayout =
    token &&
    !isOpenRoute &&
    !isSubscriptionExpiredRoute &&
    (isSuperAdmin(user?.role)
      ? isAdminRoute || isOrgRoute || location.pathname === `/${ROUTE_PATHS.INVITE}` || isSalonOwnerInviteRoute
      : isTenantScopedRole(user?.role) &&
        (isOrgRoute || isSalonOwnerInviteRoute || location.pathname === `/${ROUTE_PATHS.SALON_OWNER_DASHBOARD}`));

  return (
    <div className="app-shell min-h-dvh bg-[var(--color-surface-bg)] text-[var(--color-text-primary)]">
      <ScrollToTop />
      <PermissionsBootstrap />
      <NotificationRealtimeBridge />
      <SubscriptionGuard />
      {showLayout && <Sidebar />}

      <div
        className={`flex min-h-dvh min-w-0 flex-col ${showLayout ? 'pl-72' : 'w-full'}`}
      >
        {showLayout && <Header />}
        {showLayout && <SubscriptionExpiryBanner />}

        <main
          className={`flex-1 overflow-x-hidden ${isOpenRoute ? 'p-0' : 'bg-[var(--color-surface-bg)]'}`}
        >
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center p-8">Loading...</div>
            }
          >
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
