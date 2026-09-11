import React, { useMemo, useState } from 'react';
import { LayoutDashboard, MoreHorizontal } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { getSidebarNavItems, MODULES } from '../../../config/rbac';
import { useAppSelector } from '../../../redux/hooks';
import { useGetSubscriptionStatusQuery } from '../../../redux/slices/subscriptions/subscriptionsApi';
import { cn } from '../../../utils/cn';
import { StaffMoreMenu } from './StaffMoreMenu';

// Desired primary items order for bottom navigation shortcut
const PRIMARY_MODULE_ORDER = [
  MODULES.DASHBOARD,
  MODULES.ATTENDANCE,
  MODULES.MY_EARNINGS,
  MODULES.LEAVE,
];

export const StaffBottomNav: React.FC = () => {
  const location = useLocation();
  const user = useAppSelector((state) => state.auth.user);
  const orgId = useAppSelector((state) => state.auth.orgId);
  const permissions = useAppSelector((state) => state.auth.permissions);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const { data: subStatus } = useGetSubscriptionStatusQuery(undefined, {
    skip: user?.role === 'super_admin',
  });

  // 1. Resolve ALL currently authorized modules via RBAC + permissions + feature flags
  const authorizedNavItems = useMemo(() => {
    return getSidebarNavItems(user?.role, orgId ?? undefined, permissions, subStatus?.enabled_features);
  }, [user?.role, orgId, permissions, subStatus?.enabled_features]);

  // 2. Separate into primary bottom nav items and "More" drawer items
  const { primaryItems, moreItems } = useMemo(() => {
    const primary: typeof authorizedNavItems = [];
    const more: typeof authorizedNavItems = [];

    // Filter items that match primary shortcuts
    PRIMARY_MODULE_ORDER.forEach((mod) => {
      const match = authorizedNavItems.find((item) => item.module === mod);
      if (match) {
        primary.push(match);
      }
    });

    // All remaining authorized modules go into the More menu
    authorizedNavItems.forEach((item) => {
      if (!primary.some((p) => p.module === item.module)) {
        more.push(item);
      }
    });

    return { primaryItems: primary, moreItems: more };
  }, [authorizedNavItems]);

  const isPathActive = (path?: string) => {
    if (!path) return false;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const isAnyMoreItemActive = moreItems.some((item) => isPathActive(item.path));

  // If no modules authorized at all, do not render nav
  if (primaryItems.length === 0 && moreItems.length === 0) {
    return null;
  }

  return (
    <>
      <nav
        aria-label="Staff mobile navigation"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[var(--color-border-soft)] bg-white/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-md shadow-lg"
      >
        <div className="mx-auto flex h-16 max-w-md items-center justify-around">
          {primaryItems.map((item) => {
            const isActive = isPathActive(item.path);
            const Icon = item.icon || LayoutDashboard;

            // Friendly mobile label
            const label =
              item.module === MODULES.DASHBOARD
                ? 'Home'
                : item.module === MODULES.MY_EARNINGS
                  ? 'Earnings'
                  : item.name;

            return (
              <Link
                key={item.name}
                to={item.path || '#'}
                className={cn(
                  'flex flex-1 flex-col items-center justify-center min-h-[48px] py-1.5 transition-colors',
                  isActive
                    ? 'text-[var(--color-brand-gold-dark)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                )}
              >
                <div
                  className={cn(
                    'relative flex h-7 w-7 items-center justify-center rounded-xl transition-all',
                    isActive && 'bg-[var(--color-surface-muted)] text-[var(--color-brand-gold-dark)] font-bold'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    'mt-1 text-[11px] leading-none transition-all',
                    isActive ? 'font-bold text-[var(--color-brand-gold-dark)]' : 'font-medium'
                  )}
                >
                  {label}
                </span>
              </Link>
            );
          })}

          {/* More / Menu tab if there are additional authorized modules */}
          {moreItems.length > 0 && (
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen(true)}
              aria-label="More navigation items"
              className={cn(
                'flex flex-1 flex-col items-center justify-center min-h-[48px] py-1.5 transition-colors',
                isAnyMoreItemActive || isMoreMenuOpen
                  ? 'text-[var(--color-brand-gold-dark)]'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              )}
            >
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-xl transition-all',
                  (isAnyMoreItemActive || isMoreMenuOpen) &&
                    'bg-[var(--color-surface-muted)] text-[var(--color-brand-gold-dark)]'
                )}
              >
                <MoreHorizontal className="h-5 w-5" />
              </div>
              <span
                className={cn(
                  'mt-1 text-[11px] leading-none transition-all',
                  isAnyMoreItemActive || isMoreMenuOpen ? 'font-bold' : 'font-medium'
                )}
              >
                More
              </span>
            </button>
          )}
        </div>
      </nav>

      {/* Slide-over sheet for additional authorized items */}
      <StaffMoreMenu
        isOpen={isMoreMenuOpen}
        onClose={() => setIsMoreMenuOpen(false)}
        items={moreItems}
      />
    </>
  );
};
