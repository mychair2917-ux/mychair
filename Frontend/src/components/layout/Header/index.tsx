import React, { useState, useEffect } from 'react';
import { showSalonBranchSelector } from '../../../config/rbac';
import { useAppSelector } from '../../../redux/hooks';
import { getUserDisplayName } from '../../../redux/slices/auth/authSlice';
import {
  Search,
  Bell,
  MapPin,
  Clock,
  Moon,
  CreditCard,
  CalendarPlus,
  ChevronDown,
} from 'lucide-react';

const Header: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);
  const displayName = getUserDisplayName(user);
  const showBranchSelector = showSalonBranchSelector(user?.role);
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-[72px] bg-white/80 backdrop-blur-md border-b border-[var(--color-border-soft)] flex items-center justify-between px-6 sticky top-0 z-40 transition-all duration-200">
      <div className="flex items-center gap-6 flex-1">
        {showBranchSelector && (
          <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-3 py-1.5 rounded-lg border border-[var(--color-border-soft)] transition-colors">
            <MapPin className="h-4 w-4 text-[var(--color-text-secondary)]" />
            <span className="text-sm font-medium text-[var(--color-text-primary)]">Downtown Luxe Studio</span>
            <ChevronDown className="h-3 w-3 text-[var(--color-text-secondary)]" />
          </div>
        )}

        {/* Global Search */}
        <div className="relative max-w-md w-full hidden md:block">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-[var(--color-text-secondary)]" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-[var(--color-border-soft)] rounded-full text-sm placeholder-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-gold-light)] focus:border-transparent bg-[var(--color-surface-bg)] transition-shadow"
            placeholder="Search clients, appointments, or services... (Ctrl+K)"
          />
        </div>
      </div>

      <div className="flex items-center gap-5">
        {/* Quick Actions */}
        <div className="hidden lg:flex items-center gap-2 pr-4 border-r border-[var(--color-border-soft)]">
          <button className="flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 hover:bg-green-100 rounded-lg text-sm font-medium transition-colors">
            <Clock className="h-4 w-4" />
            Check-in
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface-bg)] border border-[var(--color-brand-gold)] text-[var(--color-brand-gold-dark)] hover:bg-[var(--color-brand-gold)] hover:text-white rounded-lg text-sm font-medium transition-colors">
            <CreditCard className="h-4 w-4" />
            POS
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-brand-gold)] text-white hover:bg-[var(--color-brand-gold-dark)] rounded-lg text-sm font-medium shadow-sm transition-colors">
            <CalendarPlus className="h-4 w-4" />
            Book
          </button>
        </div>

        {/* Current Date/Time */}
        <div className="hidden md:flex flex-col items-end mr-2">
          <span className="text-xs text-[var(--color-text-secondary)] font-medium">
            {time.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <span className="text-sm text-[var(--color-text-primary)] font-semibold">
            {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        {/* Icons */}
        <div className="flex items-center gap-3">
          <button className="p-2 text-[var(--color-text-secondary)] hover:bg-gray-100 rounded-full transition-colors relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white"></span>
          </button>
          <button className="p-2 text-[var(--color-text-secondary)] hover:bg-gray-100 rounded-full transition-colors">
            <Moon className="h-5 w-5" />
          </button>
        </div>

        {/* Profile */}
        <div className="flex items-center gap-3 pl-4 border-l border-[var(--color-border-soft)] cursor-pointer group">
          {displayName && (
            <p className="text-sm font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-gold-dark)] transition-colors hidden sm:block">
              {displayName}
            </p>
          )}
          <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-[var(--color-brand-gold-dark)] to-[var(--color-brand-gold-light)] p-[2px]">
            <div className="h-full w-full rounded-full bg-white flex items-center justify-center border-2 border-white">
              <span className="text-[var(--color-brand-gold-dark)] font-bold text-sm">
                {(displayName[0] || '?').toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
