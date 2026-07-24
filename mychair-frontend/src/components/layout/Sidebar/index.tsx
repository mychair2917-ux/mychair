import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ChevronDown, LogOut, Menu, PanelLeftClose, Scissors } from 'lucide-react';

import { getSidebarNavItems } from '../../../config/rbac';
import { useAuthActions } from '../../../hooks/useAuthActions';
import { useAppSelector } from '../../../redux/hooks';
import { getUserDisplayName } from '../../../redux/slices/auth/authSlice';
import { cn } from '../../../utils/cn';
import {
  SIDEBAR_WIDTH_COLLAPSED,
  SIDEBAR_WIDTH_EXPANDED,
  useSidebar,
} from '../SidebarContext';

function buildInitialExpandedGroups(
  navItems: ReturnType<typeof getSidebarNavItems>,
  isPathActive: (path: string) => boolean
): Record<string, boolean> {
  const initial: Record<string, boolean> = {};

  navItems.forEach((item) => {
    if (!item.children?.length) return;

    const childPaths = item.children.map((child) => child.path);
    const groupActive =
      childPaths.some(isPathActive) || Boolean(item.path && isPathActive(item.path));

    if (groupActive) {
      initial[item.name] = true;
    }
  });

  return initial;
}

const Sidebar: React.FC = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const { isSidebarOpen, isDesktop, closeSidebar, openSidebar, toggleSidebar } = useSidebar();
  const user = useAppSelector((state) => state.auth.user);
  const storedOrgId = useAppSelector((state) => state.auth.orgId);
  const permissions = useAppSelector((state) => state.auth.permissions);
  const { isLoggingOut, logoutUser } = useAuthActions();
  const effectiveOrgId = orgId ?? storedOrgId ?? undefined;
  const displayName = getUserDisplayName(user);

  const navItems = getSidebarNavItems(user?.role, effectiveOrgId, permissions);

  const isPathActive = useCallback(
    (path: string) =>
      location.pathname === path || location.pathname.startsWith(`${path}/`),
    [location.pathname]
  );

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    buildInitialExpandedGroups(navItems, isPathActive)
  );

  useEffect(() => {
    setExpandedGroups((prev) => {
      const next = { ...prev };
      let changed = false;

      navItems.forEach((item) => {
        if (!item.children?.length) return;

        const childPaths = item.children.map((child) => child.path);
        const groupActive =
          childPaths.some(isPathActive) ||
          Boolean(item.path && isPathActive(item.path));

        if (groupActive && !next[item.name]) {
          next[item.name] = true;
          changed = true;
        }
      });

      return changed ? next : prev;
    });
  }, [location.pathname, navItems, isPathActive]);

  const handleGroupClick = (itemName: string, isCurrentlyOpen: boolean) => {
    if (!isSidebarOpen) {
      openSidebar();
      setExpandedGroups((prev) => ({ ...prev, [itemName]: true }));
      return;
    }

    setExpandedGroups((prev) => ({
      ...prev,
      [itemName]: !isCurrentlyOpen,
    }));
  };

  const handleNavClick = () => {
    if (!isDesktop) {
      closeSidebar();
    }
  };

  const itemBaseClass = cn(
    'group relative flex w-full min-w-0 items-center rounded-2xl text-[0.95rem] font-medium leading-none transition-[background-color,color,box-shadow,padding] duration-200',
    isSidebarOpen ? 'justify-between px-3.5 py-3' : 'justify-center px-2 py-3'
  );
  const itemIdleClass =
    'text-[var(--color-sidebar-text-muted)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)] hover:bg-[var(--color-sidebar-hover)] hover:text-[var(--color-sidebar-text)] hover:shadow-[inset_0_0_0_1px_var(--color-sidebar-border)]';
  const itemActiveClass =
    'bg-[var(--color-sidebar-active)] text-[var(--color-sidebar-text)] shadow-[inset_0_0_0_1px_var(--color-sidebar-border-strong)]';
  const labelClass =
    'min-w-0 flex-1 truncate whitespace-nowrap text-left tracking-normal';
  const iconClass = 'h-5 w-5 shrink-0';
  const chevronClass = 'h-5 w-5 shrink-0 transition-transform duration-200';
  const activeBarClass =
    'pointer-events-none absolute inset-y-2 left-0 w-1 rounded-r-full bg-[var(--color-brand-gold)] transition-opacity duration-200';

  const childLinkClass = useMemo(
    () =>
      cn(
        'block min-w-0 truncate rounded-xl px-3 py-2.5 text-sm font-medium leading-none whitespace-nowrap tracking-normal',
        'transition-[background-color,color,box-shadow] duration-200',
        'shadow-[inset_0_0_0_1px_transparent]'
      ),
    []
  );

  return (
    <>
      <div
        aria-hidden={!isSidebarOpen || isDesktop}
        className={cn(
          'fixed inset-0 z-[45] bg-black/50 transition-opacity duration-300 lg:hidden',
          isSidebarOpen && !isDesktop ? 'opacity-100' : 'pointer-events-none opacity-0'
        )}
        onClick={closeSidebar}
      />
      <aside
        style={{
          width: isSidebarOpen ? SIDEBAR_WIDTH_EXPANDED : SIDEBAR_WIDTH_COLLAPSED,
        }}
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex h-dvh flex-col border-r border-[var(--color-sidebar-border)] bg-[var(--color-sidebar-bg)] text-[var(--color-sidebar-text)] shadow-2xl',
          'transition-[width] duration-300 ease-in-out'
        )}
      >
        <div
          className={cn(
            'shrink-0 border-b border-[var(--color-sidebar-border)]',
            isSidebarOpen ? 'px-5 py-6' : 'px-2 py-4'
          )}
        >
          <div
            className={cn(
              'flex min-w-0 items-center',
              isSidebarOpen ? 'gap-2' : 'flex-col gap-3'
            )}
          >
            <div
              className={cn(
                'flex min-w-0 items-center rounded-2xl border border-[var(--color-sidebar-border)] bg-[rgba(255,255,255,0.03)]',
                isSidebarOpen ? 'flex-1 px-4 py-3' : 'justify-center p-2'
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-brand-gold)] to-[var(--color-brand-gold-dark)] shadow-lg">
                <Scissors className="h-5 w-5 text-white" />
              </div>
              {isSidebarOpen && (
                <div className="ml-3 min-w-0">
                  <h1 className="truncate text-xl font-bold tracking-[0.01em] whitespace-nowrap text-white">
                    My Chairs
                  </h1>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={toggleSidebar}
              className="shrink-0 rounded-xl p-2 text-[var(--color-sidebar-text-muted)] transition-colors hover:bg-[var(--color-sidebar-hover)] hover:text-white"
              aria-label={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
              title={isSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isSidebarOpen ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        <nav
          className={cn(
            'custom-scrollbar flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto py-6',
            isSidebarOpen ? 'px-4' : 'px-2'
          )}
        >
          <div className="flex flex-col">
            {navItems.map((item, index) => {
              const itemGap = index > 0 ? 'mt-2' : '';

              if (item.children?.length) {
                const childPaths = item.children.map((child) => child.path);
                const groupActive =
                  childPaths.some(isPathActive) ||
                  Boolean(item.path && isPathActive(item.path));
                const isOpen = isSidebarOpen && (expandedGroups[item.name] ?? groupActive);

                return (
                  <div key={item.name} className={cn('flex min-w-0 flex-col', itemGap)}>
                    <button
                      type="button"
                      onClick={() => handleGroupClick(item.name, isOpen)}
                      aria-expanded={isOpen}
                      title={item.name}
                      className={cn(
                        itemBaseClass,
                        groupActive ? itemActiveClass : itemIdleClass
                      )}
                    >
                      <span
                        className={cn(activeBarClass, groupActive ? 'opacity-100' : 'opacity-0')}
                      />
                      <div
                        className={cn(
                          'flex min-w-0 items-center',
                          isSidebarOpen ? 'flex-1' : 'justify-center'
                        )}
                      >
                        <item.icon
                          className={cn(
                            iconClass,
                            'transition-colors duration-200',
                            groupActive
                              ? 'text-[var(--color-brand-gold-light)]'
                              : 'text-[var(--color-sidebar-icon)] group-hover:text-[var(--color-brand-gold-light)]'
                          )}
                        />
                        {isSidebarOpen && (
                          <span className={cn(labelClass, 'ml-3')}>{item.name}</span>
                        )}
                      </div>
                      {isSidebarOpen && (
                        <ChevronDown
                          className={cn(
                            chevronClass,
                            'ml-2',
                            isOpen
                              ? 'rotate-180 text-[var(--color-brand-gold-light)]'
                              : 'text-[var(--color-sidebar-icon)]'
                          )}
                        />
                      )}
                    </button>
                    {isSidebarOpen && (
                      <div
                        className={cn(
                          'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                          isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                        )}
                      >
                        <div className="overflow-hidden">
                          <div className="ml-4 flex min-w-0 flex-col border-l border-[var(--color-sidebar-border)] py-1 pl-3">
                            {item.children.map((child, childIndex) => (
                              <Link
                                key={child.path}
                                to={child.path}
                                title={child.name}
                                onClick={handleNavClick}
                                className={cn(
                                  childLinkClass,
                                  childIndex > 0 && 'mt-1',
                                  isPathActive(child.path)
                                    ? 'bg-[rgba(255,255,255,0.09)] text-white shadow-[inset_0_0_0_1px_var(--color-sidebar-border-strong)]'
                                    : 'text-[var(--color-sidebar-text-muted)] hover:bg-[rgba(255,255,255,0.05)] hover:text-white'
                                )}
                              >
                                {child.name}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              }

              if (!item.path) return null;

              const linkActive = isPathActive(item.path);

              return (
                <Link
                  key={item.name}
                  to={item.path}
                  title={item.name}
                  onClick={handleNavClick}
                  className={cn(
                    itemBaseClass,
                    itemGap,
                    linkActive ? itemActiveClass : itemIdleClass
                  )}
                >
                  <span
                    className={cn(activeBarClass, linkActive ? 'opacity-100' : 'opacity-0')}
                  />
                  <div
                    className={cn(
                      'flex min-w-0 items-center',
                      isSidebarOpen ? 'flex-1' : 'justify-center'
                    )}
                  >
                    <item.icon
                      className={cn(
                        iconClass,
                        'transition-colors duration-200',
                        linkActive
                          ? 'text-[var(--color-brand-gold-light)]'
                          : 'text-[var(--color-sidebar-icon)] group-hover:text-[var(--color-brand-gold-light)]'
                      )}
                    />
                    {isSidebarOpen && (
                      <span className={cn(labelClass, 'ml-3')}>{item.name}</span>
                    )}
                  </div>
                  {isSidebarOpen &&
                    (item.badge ? (
                      <span className="ml-2 shrink-0 rounded-full bg-[var(--color-brand-gold)] px-2 py-0.5 text-[10px] font-bold text-white">
                        {item.badge}
                      </span>
                    ) : (
                      <span className={cn(chevronClass, 'ml-2 opacity-0')} aria-hidden />
                    ))}
                </Link>
              );
            })}
          </div>
        </nav>

        <div
          className={cn(
            'shrink-0 border-t border-[var(--color-sidebar-border)]',
            isSidebarOpen ? 'p-4' : 'p-2'
          )}
        >
          <div
            className={cn(
              'mb-3 flex min-w-0 items-center rounded-2xl border border-[var(--color-sidebar-border)] bg-[rgba(255,255,255,0.04)]',
              isSidebarOpen ? 'px-3.5 py-3' : 'justify-center p-2'
            )}
            title={displayName || 'User'}
          >
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
            {isSidebarOpen && (
              <div className="ml-3 min-w-0 flex-1">
                <p className="truncate text-sm font-semibold whitespace-nowrap text-white">
                  {displayName || 'User'}
                </p>
                <p className="truncate text-xs whitespace-nowrap text-[var(--color-sidebar-text-muted)]">
                  {user?.branch_name || user?.salon_name || user?.email}
                </p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={logoutUser}
            disabled={isLoggingOut}
            title={isLoggingOut ? 'Logging out...' : 'Logout'}
            className={cn(
              'group flex w-full min-w-0 items-center rounded-2xl text-[var(--color-sidebar-text-muted)] shadow-[inset_0_0_0_1px_transparent] transition-[background-color,color,box-shadow] duration-200 hover:bg-[rgba(127,29,29,0.28)] hover:text-white hover:shadow-[inset_0_0_0_1px_rgba(248,113,113,0.28)] disabled:cursor-not-allowed disabled:opacity-60',
              isSidebarOpen ? 'px-3.5 py-3' : 'justify-center px-2 py-3'
            )}
          >
            <LogOut className="h-5 w-5 shrink-0 transition-colors group-hover:text-red-400" />
            {isSidebarOpen && (
              <span className="ml-3 truncate text-sm font-medium whitespace-nowrap">
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
