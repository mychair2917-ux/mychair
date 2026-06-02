import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { NavLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ChevronDown, LogOut, Scissors } from 'lucide-react';

import { getSidebarNavItems } from '../../../config/rbac';
import { ROUTE_PATHS } from '../../../constants';
import { logout } from '../../../redux/slices/auth/authSlice';
import { useAppSelector } from '../../../redux/hooks';

const Sidebar: React.FC = () => {
  const { orgId } = useParams();
  const location = useLocation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const storedOrgId = useAppSelector((state) => state.auth.orgId);
  const effectiveOrgId = orgId ?? storedOrgId ?? undefined;
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    'Salon Management': true,
  });

  const navItems = getSidebarNavItems(user?.role, effectiveOrgId);

  const handleLogout = () => {
    dispatch(logout());
    navigate(`/${ROUTE_PATHS.LOGIN}`);
  };

  const toggleGroup = (name: string) => {
    setExpandedGroups((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const isPathActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <aside className="z-50 flex h-screen w-72 flex-col bg-[var(--color-sidebar-bg)] text-[var(--color-sidebar-text)] shadow-2xl">
      <div className="flex items-center gap-3 border-b border-[var(--color-sidebar-hover)] p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-brand-gold)] to-[var(--color-brand-gold-dark)] shadow-lg">
          <Scissors className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="font-['Outfit'] text-xl font-bold tracking-wide text-white">My Chairs</h1>
          <p className="text-[10px] font-medium tracking-widest text-[var(--color-brand-gold-light)] uppercase">
            Salon & Spa
          </p>
        </div>
      </div>

      <nav className="custom-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-6">
        {navItems.map((item) => {
          if (item.children?.length) {
            const childPaths = item.children.map((c) => c.path);
            const groupActive = childPaths.some(isPathActive) || Boolean(item.path && isPathActive(item.path));
            const isOpen = expandedGroups[item.name] ?? groupActive;

            return (
              <div key={item.name} className="flex flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => toggleGroup(item.name)}
                  className={`group flex w-full items-center justify-between rounded-xl px-3 py-2.5 transition-all duration-200 ${
                    groupActive
                      ? 'bg-gradient-to-r from-[var(--color-sidebar-hover)] to-transparent text-white'
                      : 'text-gray-400 hover:bg-[var(--color-sidebar-hover)] hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon
                      className={`h-5 w-5 transition-colors ${groupActive ? 'text-[var(--color-brand-gold)]' : 'group-hover:text-[var(--color-brand-gold-light)]'}`}
                    />
                    <span className={`text-sm font-medium ${groupActive ? 'font-semibold' : ''}`}>
                      {item.name}
                    </span>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && (
                  <div className="ml-4 flex flex-col gap-0.5 border-l border-[var(--color-sidebar-hover)] pl-2">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.path}
                        to={child.path}
                        className={({ isActive }) =>
                          `rounded-lg px-3 py-2 text-sm transition-colors ${
                            isActive
                              ? 'bg-[var(--color-sidebar-hover)] font-semibold text-white'
                              : 'text-gray-400 hover:bg-[var(--color-sidebar-hover)] hover:text-white'
                          }`
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
              className={({ isActive }) =>
                `group flex items-center justify-between rounded-xl px-3 py-2.5 transition-all duration-200 ${
                  isActive
                    ? 'bg-gradient-to-r from-[var(--color-sidebar-hover)] to-transparent text-white'
                    : 'text-gray-400 hover:bg-[var(--color-sidebar-hover)] hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="flex items-center gap-3">
                    <item.icon
                      className={`h-5 w-5 transition-colors ${isActive ? 'text-[var(--color-brand-gold)]' : 'group-hover:text-[var(--color-brand-gold-light)]'}`}
                    />
                    <span className={`text-sm font-medium ${isActive ? 'font-semibold' : ''}`}>
                      {item.name}
                    </span>
                  </div>
                  {item.badge && (
                    <span className="rounded-full bg-[var(--color-brand-gold)] px-2 py-0.5 text-[10px] font-bold text-white">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      <div className="border-t border-[var(--color-sidebar-hover)] p-4">
        <button
          onClick={handleLogout}
          className="group flex w-full items-center gap-3 rounded-xl px-3 py-3 text-gray-400 transition-all hover:bg-[var(--color-sidebar-hover)] hover:text-white"
        >
          <LogOut className="h-5 w-5 transition-colors group-hover:text-red-400" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
