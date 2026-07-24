import { Link } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';

import { ROUTE_PATHS } from '../../constants';
import { isSuperAdmin } from '../../config/rbac';
import { useAppSelector } from '../../redux/hooks';
import {
  useListNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '../../redux/slices/notifications/notificationsApi';
import { formatDateDMY } from '../../utils/utilities';

interface NotificationDrawerProps {
  onClose: () => void;
}

const NotificationDrawer = ({ onClose }: NotificationDrawerProps) => {
  const user = useAppSelector((state) => state.auth.user);
  const orgId = useAppSelector((state) => state.auth.orgId);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId);
  const salonId = selectedSalonId || undefined;
  const { data, isFetching } = useListNotificationsQuery({
    page: 1,
    limit: 10,
    salon_id: salonId,
  });
  const [markRead] = useMarkNotificationReadMutation();
  const [markAllRead, { isLoading: isMarkingAll }] = useMarkAllNotificationsReadMutation();

  const modulePath = isSuperAdmin(user?.role)
    ? `/${ROUTE_PATHS.ADMIN_NOTIFICATIONS_COMMUNICATION}`
    : `/orgs/${orgId}/${ROUTE_PATHS.NOTIFICATIONS_COMMUNICATION}`;

  return (
    <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-[min(360px,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">Notifications</p>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {data?.data.unread_count ?? 0} unread
          </p>
        </div>
        <button
          type="button"
          disabled={isMarkingAll}
          onClick={() => markAllRead({ salon_id: salonId })}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-[var(--color-brand-gold-dark)] hover:bg-[var(--color-surface-bg)] disabled:opacity-60"
        >
          <CheckCheck className="h-3.5 w-3.5" />
          Mark all
        </button>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {isFetching && <div className="p-4 text-sm text-gray-500">Loading notifications...</div>}
        {!isFetching && (data?.data.items.length ?? 0) === 0 && (
          <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
            <Bell className="h-8 w-8 text-gray-300" />
            <p className="mt-3 text-sm font-semibold text-gray-700">No notifications yet</p>
            <p className="mt-1 text-xs text-gray-500">New alerts will appear here in real time.</p>
          </div>
        )}
        {data?.data.items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (!item.is_read) markRead(item.id);
            }}
            className={`block w-full border-b border-[var(--color-border-soft)] px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface-bg)] ${
              item.is_read ? 'bg-white' : 'bg-amber-50/60'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-semibold text-gray-900">{item.title}</p>
              {!item.is_read && <span className="mt-1 h-2 w-2 rounded-full bg-red-500" />}
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-gray-600">{item.body}</p>
            <div className="mt-2 flex items-center justify-between text-[11px] text-gray-400">
              <span>{item.category.replace(/_/g, ' ')}</span>
              <span>{formatDateDMY(item.created_at)}</span>
            </div>
          </button>
        ))}
      </div>
      <Link
        to={modulePath}
        onClick={onClose}
        className="block border-t border-[var(--color-border-soft)] px-4 py-3 text-center text-sm font-semibold text-[var(--color-brand-gold-dark)] hover:bg-[var(--color-surface-bg)]"
      >
        Open notification center
      </Link>
    </div>
  );
};

export default NotificationDrawer;
