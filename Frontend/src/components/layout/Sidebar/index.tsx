import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  Boxes,
  Calendar,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  FileText,
  LayoutDashboard,
  LineChart,
  LogOut,
  Megaphone,
  PackageOpen,
  Scissors,
  Settings,
  ShoppingBag,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';

import { ROUTE_PATHS } from '../../../constants';
import { logout } from '../../../redux/slices/auth/authSlice';

interface NavGroup {
  label: string;
  items: {
    name: string;
    path: string;
    icon: React.ElementType;
    badge?: string;
  }[];
}

const Sidebar: React.FC = () => {
  const { orgId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleLogout = () => {
    dispatch(logout());
    navigate(`/${ROUTE_PATHS.LOGIN}`);
  };

  const navGroups: NavGroup[] = [
    {
      label: 'MAIN',
      items: [
        {
          name: 'Dashboard',
          path: `/orgs/${orgId}/${ROUTE_PATHS.DASHBOARD}`,
          icon: LayoutDashboard,
        },
      ],
    },
    {
      label: 'OPERATIONS',
      items: [
        { name: 'Calendar', path: `/orgs/${orgId}/calendar`, icon: Calendar },
        {
          name: 'Appointments',
          path: `/orgs/${orgId}/appointments`,
          icon: CalendarDays,
          badge: '3',
        },
        { name: 'Walk-ins', path: `/orgs/${orgId}/walk-ins`, icon: UserPlus },
        { name: 'POS Billing', path: `/orgs/${orgId}/billing`, icon: ShoppingBag },
        { name: 'Clients', path: `/orgs/${orgId}/clients`, icon: Users },
      ],
    },
    {
      label: 'MANAGEMENT',
      items: [
        { name: 'Staff', path: `/orgs/${orgId}/staff`, icon: Sparkles },
        { name: 'Services', path: `/orgs/${orgId}/services`, icon: Scissors },
        { name: 'Packages', path: `/orgs/${orgId}/packages`, icon: PackageOpen },
        { name: 'Inventory', path: `/orgs/${orgId}/inventory`, icon: Boxes },
      ],
    },
    {
      label: 'BUSINESS',
      items: [
        { name: 'Reports', path: `/orgs/${orgId}/reports`, icon: LineChart },
        { name: 'CRM', path: `/orgs/${orgId}/crm`, icon: Megaphone },
        { name: 'Payroll', path: `/orgs/${orgId}/payroll`, icon: Wallet },
        { name: 'Settings', path: `/orgs/${orgId}/${ROUTE_PATHS.SETTINGS}`, icon: Settings },
      ],
    },
  ];

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

      <nav className="custom-scrollbar flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-6">
        {navGroups.map((group, idx) => (
          <div key={idx}>
            <p className="mb-3 px-3 text-xs font-semibold tracking-wider text-gray-500">
              {group.label}
            </p>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => (
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
              ))}
            </div>
          </div>
        ))}
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
