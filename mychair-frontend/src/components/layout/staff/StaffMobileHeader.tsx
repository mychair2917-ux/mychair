import React, { useMemo, useState } from 'react';
import { Bell, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import NotificationDrawer from '../../notifications/NotificationDrawer';
import { useAppSelector } from '../../../redux/hooks';
import { getUserDisplayName } from '../../../redux/slices/auth/authSlice';
import { useGetUnreadNotificationCountQuery } from '../../../redux/slices/notifications/notificationsApi';
import { resolveMediaUrl } from '../../../utils/media';

const ROUTE_TITLES: Record<string, string> = {
  dashboard: 'Dashboard',
  attendance: 'Attendance',
  'my-earnings': 'My Earnings',
  leave: 'Leave Management',
  profile: 'My Profile',
  'notifications-communication': 'Notifications',
  appointments: 'Appointments',
  'appointment-register': 'Appointments',
  services: 'Services',
};

export const StaffMobileHeader: React.FC = () => {
  const location = useLocation();
  const user = useAppSelector((state) => state.auth.user);
  const orgId = useAppSelector((state) => state.auth.orgId);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId);
  const displayName = getUserDisplayName(user);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);

  const { data: unreadData } = useGetUnreadNotificationCountQuery({
    salon_id: selectedSalonId || undefined,
  });
  const unreadCount = unreadData?.data?.unread_count ?? 0;

  // Determine current page title from pathname
  const pageTitle = useMemo(() => {
    const segments = location.pathname.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1] || '';
    return ROUTE_TITLES[lastSegment] || 'MyChair';
  }, [location.pathname]);

  const profileUrl = orgId ? `/orgs/${orgId}/profile` : '#';
  const avatarUrl = user?.avatar ? resolveMediaUrl(user.avatar) : null;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-40 flex h-[58px] items-center justify-between border-b border-[var(--color-border-soft)] bg-white/92 px-3.5 backdrop-blur-md transition-all sm:px-5">
        {/* Left: Brand logo & Page Title */}
        <div className="flex items-center gap-2.5 min-w-0">
          <Link
            to={orgId ? `/orgs/${orgId}/dashboard` : '/'}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] border border-[var(--color-border-soft)] shadow-2xs"
            aria-label="MyChair Home"
          >
            <img src="/icons/icon-192x192.png" alt="MyChair" className="h-6 w-6 object-contain" />
          </Link>
          <div className="min-w-0">
            <h1 className="truncate text-base font-bold tracking-tight text-[var(--color-text-primary)]">
              {pageTitle}
            </h1>
          </div>
        </div>

        {/* Right: Notification Bell & Profile Avatar */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Notification Button with Badge */}
          <button
            type="button"
            onClick={() => setIsNotificationDrawerOpen((prev) => !prev)}
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text-primary)] transition"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white shadow-2xs animate-pulse">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {/* User Profile Avatar Link */}
          <Link
            to={profileUrl}
            aria-label="View Profile"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] overflow-hidden shadow-2xs transition hover:ring-2 hover:ring-[var(--color-brand-gold)]"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : (
              <span className="text-xs font-bold text-[var(--color-brand-gold-dark)]">
                {displayName ? displayName.charAt(0).toUpperCase() : <User className="h-4 w-4" />}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Shared Realtime Notification Drawer */}
      {isNotificationDrawerOpen && (
        <NotificationDrawer onClose={() => setIsNotificationDrawerOpen(false)} />
      )}
    </>
  );
};
