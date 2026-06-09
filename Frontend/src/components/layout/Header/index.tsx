import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { showSalonBranchSelector } from '../../../config/rbac';
import { CommonDropdown } from '../../common';
import { useAppDispatch, useAppSelector } from '../../../redux/hooks';
import { getUserDisplayName, setSelectedSalonId } from '../../../redux/slices/auth/authSlice';
import { baseApi } from '../../../redux/slices/api/baseApi';
import { useGetSalonsListQuery } from '../../../redux/slices/salons/salonsApi';
import {
  Bell,
  ChevronDown,
  LogOut,
  Settings,
  UserCircle2,
} from 'lucide-react';
import { formatDateDMY } from '../../../utils/utilities';
import { getProfilePath, getSettingsPath } from '../../../redux/slices/auth/authSession';
import { useAuthActions } from '../../../hooks/useAuthActions';

const Header: React.FC = () => {
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId);
  const orgId = useAppSelector((state) => state.auth.orgId);
  const displayName = getUserDisplayName(user);
  const showBranchSelector = showSalonBranchSelector(user?.role);
  const [time, setTime] = useState(new Date());
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const { isLoggingOut, logoutUser } = useAuthActions();
  const { data: salonsData, isLoading: isLoadingSalons } = useGetSalonsListQuery(undefined, {
    skip: !showBranchSelector,
  });
  const salonOptions = (salonsData?.data ?? []).map((item) => ({
    value: item.salon_id,
    label: item.salon_name || '-',
  }));

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (!showBranchSelector || selectedSalonId || salonOptions.length === 0) {
      return;
    }
    dispatch(setSelectedSalonId(String(salonOptions[0].value)));
  }, [dispatch, salonOptions, selectedSalonId, showBranchSelector]);

  const profilePath = useMemo(() => getProfilePath(user?.role, orgId), [orgId, user?.role]);
  const settingsPath = useMemo(() => getSettingsPath(user?.role, orgId), [orgId, user?.role]);
  const profileMenuItems = [
    profilePath ? { label: 'Profile', to: profilePath, icon: UserCircle2 } : null,
    settingsPath ? { label: 'Settings', to: settingsPath, icon: Settings } : null,
  ].filter(Boolean) as Array<{ label: string; to: string; icon: React.ElementType }>;

  return (
    <header className="sticky top-0 z-40 flex h-[76px] items-center justify-between border-b border-[var(--color-border-soft)] bg-white/88 px-4 backdrop-blur-md transition-all duration-200 sm:px-6">
      <div className="flex flex-1 items-center gap-4 md:gap-6">
        {showBranchSelector && (
          <div className="w-full max-w-sm min-w-60">
            <CommonDropdown
              options={salonOptions}
              value={selectedSalonId ?? ''}
              onChange={(value) => {
                dispatch(setSelectedSalonId(value ? String(value) : null));
                dispatch(baseApi.util.resetApiState());
              }}
              placeholder="Select salon"
              searchable
              loading={isLoadingSalons}
              clearable={false}
            />
          </div>
        )}

        <div className="hidden w-3/5 flex-1 md:block">
          <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] px-4 py-3 shadow-sm">
            <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
              Premium salon operations    </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-5">
        <div className="hidden md:flex flex-col items-end pr-2">
          <span className="text-xs font-medium tracking-[0.02em] text-[var(--color-text-secondary)]">
            {formatDateDMY(time)}
          </span>
          <span className="text-sm font-semibold text-[var(--color-text-primary)]">
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            className="relative rounded-full p-2 text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-bg)] hover:text-[var(--color-text-primary)]"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-red-500"></span>
          </button>
        </div>

        <div ref={profileMenuRef} className="relative border-l border-[var(--color-border-soft)] pl-3 sm:pl-4">
          <button
            type="button"
            onClick={() => setIsProfileMenuOpen((current) => !current)}
            className="group flex items-center gap-3 rounded-2xl border border-transparent px-2 py-1.5 transition-all duration-200 hover:border-[var(--color-border-soft)] hover:bg-[var(--color-surface-bg)]"
            aria-expanded={isProfileMenuOpen}
            aria-haspopup="menu"
          >
            {displayName && (
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold capitalize text-[var(--color-text-primary)] transition-colors group-hover:text-[var(--color-brand-gold-dark)]">
                  {displayName}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
                  {user?.role?.replace(/_/g, ' ') || 'User'}
                </p>
              </div>
            )}
            <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[var(--color-brand-gold-dark)] to-[var(--color-brand-gold-light)] p-[2px] shadow-sm">
              <div className="flex h-full w-full items-center justify-center rounded-full border-2 border-white bg-white">
                {user?.avatar ? (
                  <img
                    src={user.avatar}
                    alt={displayName || 'User avatar'}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  <span className="text-sm font-bold text-[var(--color-brand-gold-dark)]">
                    {(displayName[0] || '?').toUpperCase()}
                  </span>
                )}
              </div>
            </div>
            <ChevronDown
              className={`hidden h-4 w-4 text-[var(--color-text-secondary)] transition-transform sm:block ${
                isProfileMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isProfileMenuOpen && (
            <div className="absolute right-0 top-[calc(100%+0.75rem)] z-50 w-60 overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-white p-2 shadow-card">
              <div className="border-b border-[var(--color-border-soft)] px-3 py-2.5">
                <p className="text-sm font-semibold capitalize text-[var(--color-text-primary)]">
                  {displayName || 'User'}
                </p>
                <p className="truncate text-xs text-[var(--color-text-secondary)]">{user?.email}</p>
              </div>

              <div className="py-2">
                {profileMenuItems.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    onClick={() => setIsProfileMenuOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-bg)]"
                  >
                    <item.icon className="h-4 w-4 text-[var(--color-brand-gold-dark)]" />
                    <span>{item.label}</span>
                  </Link>
                ))}
              </div>

              <div className="border-t border-[var(--color-border-soft)] pt-2">
                <button
                  type="button"
                  onClick={logoutUser}
                  disabled={isLoggingOut}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <LogOut className="h-4 w-4" />
                  <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
