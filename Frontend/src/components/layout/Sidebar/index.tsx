import React, { useState } from 'react';
import { NavLink, useLocation, useParams } from 'react-router-dom';
import { ChevronDown, LogOut, Scissors } from 'lucide-react';

import { getSidebarNavItems } from '../../../config/rbac';
import { useAppSelector } from '../../../redux/hooks';
import { useAuthActions } from '../../../hooks/useAuthActions';
import { getUserDisplayName } from '../../../redux/slices/auth/authSlice';
import { cn } from '../../../utils/cn';

const Sidebar: React.FC = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const user = useAppSelector((state) => state.auth.user);
  const storedOrgId = useAppSelector((state) => state.auth.orgId);
  const permissions = useAppSelector((state) => state.auth.permissions);
  const { isLoggingOut, logoutUser } = useAuthActions();
  const effectiveOrgId = orgId ?? storedOrgId ?? undefined;
  const displayName = getUserDisplayName(user);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Salon Management': true,
  });

  const navItems = getSidebarNavItems(user?.role, effectiveOrgId, permissions);

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const isPathActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const itemBaseClass =
    'group relative flex w-full min-w-0 items-center justify-between gap-2 overflow-hidden rounded-2xl border border-transparent px-3.5 py-3 text-[0.95rem] font-medium transition-colors duration-200';
  const itemIdleClass =
    'text-[var(--color-sidebar-text-muted)] hover:border-[var(--color-sidebar-border)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-text)]';
  const itemActiveClass =
    'border-[var(--color-sidebar-border-strong)] bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-text)] shadow-[0_14px_30px_rgba(0,0,0,0.28)]';
  const labelClass = 'min-w-0 flex-1 truncate whitespace-nowrap text-left';
  const iconClass = 'h-5 w-5 shrink-0';
  const activeBarClass =
    'pointer-events-none absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--color-brand-gold)]';

  return (
    <aside className="z-50 flex h-screen w-72 min-w-[18rem] max-w-[18rem] shrink-0 flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-bg)] text-[var(--color-sidebar-text)] shadow-2xl">
      <div className="shrink-0 border-b border-[var(--color-sidebar-border)] px-5 py-6">
        <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--color-sidebar-border)] bg-[rgba(255,255,255,0.03)] px-4 py-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-brand-gold)] to-[var(--color-brand-gold-dark)] shadow-lg">
            <Scissors className="h-5 w-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate whitespace-nowrap text-xl font-bold tracking-[0.01em] text-white">
              My Chairs
            </h1>
            {/* <p className="truncate whitespace-nowrap text-[10px] font-semibold tracking-[0.26em] text-[var(--color-brand-gold-light)] uppercase">
              Salon & Spa
            </p> */}
          </div>
        </div>
      </div>

      <nav className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden px-4 py-6">
        {navItems.map((item) => {
          if (item.children?.length) {
            const childPaths = item.children.map((c) => c.path);
            const groupActive =
              childPaths.some(isPathActive) || Boolean(item.path && isPathActive(item.path));
            const isOpen = expandedGroups[item.name] ?? groupActive;

            return (
              <div key={item.name} className="flex min-w-0 flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.name)}
                  className={cn(itemBaseClass, groupActive ? itemActiveClass : itemIdleClass)}
                >
                  <span className={cn(activeBarClass, !groupActive && 'opacity-0')} />
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <item.icon
                      className={cn(
                        iconClass,
                        'transition-colors',
                        groupActive
                          ? 'text-[var(--color-brand-gold-light)]'
                          : 'text-[var(--color-sidebar-icon)] group-hover:text-[var(--color-brand-gold-light)]'
                      )}
                    />
                    <span className={labelClass}>{item.name}</span>
                  </div>
                  <ChevronDown
                    className={cn(
                      iconClass,
                      'transition-transform',
                      isOpen
                        ? 'rotate-180 text-[var(--color-brand-gold-light)]'
                        : 'text-[var(--color-sidebar-icon)]'
                    )}
                  />
                </button>
                {isOpen && (
                  <div className="ml-4 flex min-w-0 flex-col gap-1 border-l border-[var(--color-sidebar-border)] pl-3 pt-1">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        title={child.name}
                        className={({ isActive }) =>
                          cn(
                            'block min-w-0 truncate whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200',
                            isActive
                              ? 'bg-[rgba(255,255,255,0.09)] text-white shadow-[inset_0_0_0_1px_var(--color-sidebar-border-strong)]'
                              : 'text-[var(--color-sidebar-text-muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white'
                          )
                        }
                      >
                        {child.name}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          if (!item.path) return null;

          return (
            <NavLink
              key={item.name}
              to={item.path}
              title={item.name}
              className={({ isActive }) =>
                cn(itemBaseClass, isActive ? itemActiveClass : itemIdleClass)
              }
            >
              {({ isActive }) => (
                <>
                  <span className={cn(activeBarClass, !isActive && 'opacity-0')} />
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <item.icon
                      className={cn(
                        iconClass,
                        'transition-colors',
                        isActive
                          ? 'text-[var(--color-brand-gold-light)]'
                          : 'text-[var(--color-sidebar-icon)] group-hover:text-[var(--color-brand-gold-light)]'
                      )}
                    />
                    <span className={labelClass}>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="shrink-0 rounded-full bg-[var(--color-brand-gold)] px-2 py-0.5 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-[var(--color-sidebar-border)] p-4">
        <div className="mb-3 flex min-w-0 items-center gap-3 rounded-2xl border border-[var(--color-sidebar-border)] bg-[rgba(255,255,255,0.04)] px-3.5 py-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[rgba(255,255,255,0.16)] bg-[rgba(255,255,255,0.08)]">
            {user?.avatar ? (
              <img
                src={user.avatar}
                alt={displayName || 'User avatar'}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-white">
                {(displayName[0] || 'U').toUpperCase()}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate whitespace-nowrap text-sm font-semibold text-white">
              {displayName || 'User'}
            </p>
            <p className="truncate whitespace-nowrap text-xs text-[var(--color-sidebar-text-muted)]">
              {user?.branch_name || user?.salon_name || user?.email}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={logoutUser}
          disabled={isLoggingOut}
          className="group flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-transparent px-3.5 py-3 text-[var(--color-sidebar-text-muted)] transition-colors duration-200 hover:border-[rgba(248,113,113,0.28)] hover:bg-[rgba(127,29,29,0.28)] hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LogOut className="h-5 w-5 shrink-0 transition-colors group-hover:text-red-400" />
          <span className="truncate whitespace-nowrap text-sm font-medium">
            {isLoggingOut ? 'Logging out...' : 'Logout'}
          </span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
