import React from 'react';
import { Download, LogOut, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

import { useAuthActions } from '../../../hooks/useAuthActions';
import { usePWAInstall } from '../../../hooks/usePWAInstall';
import { useAppSelector } from '../../../redux/hooks';
import { getUserDisplayName } from '../../../redux/slices/auth/authSlice';
import type { SidebarNavItem } from '../../../config/rbac';
import { cn } from '../../../utils/cn';
import { resolveMediaUrl } from '../../../utils/media';

interface StaffMoreMenuProps {
  isOpen: boolean;
  onClose: () => void;
  items: SidebarNavItem[];
}

export const StaffMoreMenu: React.FC<StaffMoreMenuProps> = ({ isOpen, onClose, items }) => {
  const location = useLocation();
  const user = useAppSelector((state) => state.auth.user);
  const displayName = getUserDisplayName(user);
  const avatarUrl = user?.avatar ? resolveMediaUrl(user.avatar) : null;
  const { isLoggingOut, logoutUser } = useAuthActions();
  const { canInstall, hasNativePrompt, install } = usePWAInstall();

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    if (hasNativePrompt) {
      await install();
      onClose();
    }
  };

  const handleLogoutClick = async () => {
    onClose();
    await logoutUser();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      {/* Backdrop overlay dismiss */}
      <div className="flex-1" onClick={onClose} aria-hidden="true" />

      {/* Bottom sheet content */}
      <div className="w-full max-h-[85dvh] overflow-y-auto rounded-t-3xl border-t border-[var(--color-border-soft)] bg-white p-5 shadow-2xl animate-in slide-in-from-bottom duration-300">
        {/* Handle / Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
              ) : (
                <span className="text-sm font-bold text-[var(--color-brand-gold-dark)]">
                  {displayName ? displayName.charAt(0).toUpperCase() : 'S'}
                </span>
              )}
            </div>
            <div>
              <p className="font-bold text-sm text-[var(--color-text-primary)]">{displayName}</p>
              <p className="text-xs text-[var(--color-text-secondary)]">Staff Member</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* List of Accessible Modules */}
        <div className="my-4 space-y-1.5">
          <p className="px-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
            Authorized Modules
          </p>
          {items.map((item) => {
            const Icon = item.icon;
            const isActive =
              Boolean(item.path) &&
              (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`));

            return (
              <Link
                key={item.name}
                to={item.path || '#'}
                onClick={onClose}
                className={cn(
                  'flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition-colors',
                  isActive
                    ? 'bg-[var(--color-surface-muted)] text-[var(--color-brand-gold-dark)] font-bold'
                    : 'text-[var(--color-text-primary)] hover:bg-[var(--color-surface-bg)]'
                )}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
                      isActive
                        ? 'bg-[var(--color-brand-gold)] text-white shadow-2xs'
                        : 'bg-[var(--color-surface-muted)] text-[var(--color-brand-gold-dark)]'
                    )}
                  >
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <span>{item.name}</span>
                </div>

                {item.badge && (
                  <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Actions (PWA install if available & Sign Out) */}
        <div className="space-y-2 border-t border-[var(--color-border-soft)] pt-4">
          {canInstall && (
            <button
              type="button"
              onClick={handleInstallClick}
              className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--color-surface-bg)] transition"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-[var(--color-brand-gold-dark)] border border-amber-200">
                <Download className="h-4.5 w-4.5" />
              </div>
              <span>Install App on Phone</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleLogoutClick}
            disabled={isLoggingOut}
            className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
              <LogOut className="h-4.5 w-4.5" />
            </div>
            <span>{isLoggingOut ? 'Signing out...' : 'Sign Out'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
