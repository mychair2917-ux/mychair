import { Suspense } from 'react';
import { Outlet, useLocation } from 'react-router';

import { ErrorBoundary } from './components/common';
import PermissionsBootstrap from './components/permissions/PermissionsBootstrap';
import NotificationRealtimeBridge from './components/notifications/NotificationRealtimeBridge';
import SubscriptionExpiryBanner from './components/subscription/SubscriptionExpiryBanner';
import SubscriptionGuard from './components/subscription/SubscriptionGuard';
import { Header, Sidebar, SidebarProvider, useSidebar } from './components/layout';
import ScrollToTop from './components/layout/ScrollToTop';
import { isSuperAdmin, isTenantScopedRole } from './config/rbac';
import { PUBLIC_ROUTES, ROUTE_PATHS } from './constants';
import { useAppSelector } from './redux/hooks';
import { cn } from './utils/cn';

function AuthenticatedShell() {
  const { isSidebarOpen, isDesktop } = useSidebar();

  return (
    <>
      <Sidebar />
      <div
        className={cn(
          'flex min-h-dvh min-w-0 flex-col transition-[padding] duration-300 ease-in-out',
          isSidebarOpen && isDesktop ? 'pl-72' : 'pl-[4.5rem]'
        )}
      >
        <Header />
        <div className="pt-[76px]">
          <SubscriptionExpiryBanner />
          <main className="flex-1 overflow-x-hidden bg-[var(--color-surface-bg)]">
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
    </>
  );
}

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

      {showLayout ? (
        <SidebarProvider>
          <AuthenticatedShell />
        </SidebarProvider>
      ) : (
        <div className="flex min-h-dvh min-w-0 w-full flex-col">
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
      )}
    </div>
  );
}

export default App;
