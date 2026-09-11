import React, { Suspense } from 'react';
import { Outlet } from 'react-router';

import AuthProfileSync from '../../auth/AuthProfileSync';
import { ErrorBoundary } from '../../common';
import { PWAInstallBanner } from '../../pwa/PWAInstallBanner';
import { StaffBottomNav } from './StaffBottomNav';
import { StaffMobileHeader } from './StaffMobileHeader';

export const StaffMobileShell: React.FC = () => {
  return (
    <div className="relative flex min-h-dvh w-full flex-col bg-[var(--color-surface-bg)] text-[var(--color-text-primary)]">
      {/* Synchronization bridge for auth profile */}
      <AuthProfileSync />

      {/* Compact Staff Mobile Header */}
      <StaffMobileHeader />

      {/* Main Routed Content */}
      <div className="flex-1 w-full pt-[58px] pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
        <main className="w-full overflow-x-hidden min-h-[calc(100dvh-58px-4.5rem)]">
          <Suspense
            fallback={
              <div className="flex h-64 items-center justify-center p-8 text-sm text-[var(--color-text-secondary)]">
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--color-brand-gold)] border-t-transparent" />
                  Loading...
                </div>
              </div>
            }
          >
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </Suspense>
        </main>

        {/* Floating PWA Install Prompt for Staff */}
        <PWAInstallBanner className="mt-4" />
      </div>

      {/* Fixed Permission-Aware Bottom Navigation */}
      <StaffBottomNav />
    </div>
  );
};
