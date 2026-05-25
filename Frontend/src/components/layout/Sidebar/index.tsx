import React from 'react';
import { useDispatch } from 'react-redux';
import { NavLink, useNavigate, useParams } from 'react-router-dom';
import {
  Bell,
  Boxes,
  CreditCard,
  LayoutDashboard,
  LineChart,
  LogOut,
  MailPlus,
  Scissors,
  Shield,
  Store,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';

import { ROLES, ROUTE_PATHS } from '../../../constants';
import { logout } from '../../../redux/slices/auth/authSlice';
import { useAppSelector } from '../../../redux/hooks';
import { canUserInvite } from '../../../utils/invitePermissions';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
  badge?: string;
}

const Sidebar: React.FC = () => {
  const { orgId } = useParams();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const showInvite = canUserInvite(user?.role);
  const invitePath = isSuperAdmin
    ? `/${ROUTE_PATHS.ADMIN_INVITE}`
    : user?.role === ROLES.SALON_OWNER
      ? `/${ROUTE_PATHS.SALON_INVITE}`
      : `/orgs/${orgId}/${ROUTE_PATHS.ORG_INVITE}`;

  const handleLogout = () => {
    dispatch(logout());
    navigate(`/${ROUTE_PATHS.LOGIN}`);
  };

  const superAdminInvitePath = `/${ROUTE_PATHS.ADMIN_INVITE}`;

  const navItems: NavItem[] = isSuperAdmin
    ? [
        {
          name: 'Dashboard',
          path: `/${ROUTE_PATHS.ADMIN_DASHBOARD}`,
          icon: LayoutDashboard,
        },
        ...(showInvite
          ? [{ name: 'Invite', path: superAdminInvitePath, icon: MailPlus }]
          : []),
        {
          name: 'Salon Management',
          path: `/${ROUTE_PATHS.ADMIN_SALON_MANAGEMENT}`,
          icon: Store,
        },
        {
          name: 'User Management',
          path: `/${ROUTE_PATHS.ADMIN_USER_MANAGEMENT}`,
          icon: Users,
        },
        {
          name: 'Role & Permissions',
          path: `/${ROUTE_PATHS.ADMIN_ROLES_PERMISSIONS}`,
          icon: Shield,
        },
        {
          name: 'Subscription Management',
          path: `/${ROUTE_PATHS.ADMIN_SUBSCRIPTION_MANAGEMENT}`,
          icon: CreditCard,
        },
        {
          name: 'Billing & Finance',
          path: `/${ROUTE_PATHS.ADMIN_BILLING_FINANCE}`,
          icon: Wallet,
        },
        {
          name: 'Products & Inventory',
          path: `/${ROUTE_PATHS.ADMIN_PRODUCTS_INVENTORY}`,
          icon: Boxes,
        },
        {
          name: 'Staff & HR Monitoring',
          path: `/${ROUTE_PATHS.ADMIN_STAFF_MONITORING}`,
          icon: UserCheck,
        },
        {
          name: 'Customer Analytics',
          path: `/${ROUTE_PATHS.ADMIN_CUSTOMER_ANALYTICS}`,
          icon: LineChart,
        },
        {
          name: 'Notifications & Communication',
          path: `/${ROUTE_PATHS.ADMIN_NOTIFICATIONS_COMMUNICATION}`,
          icon: Bell,
        },
      ]
    : [
        {
          name: 'Dashboard',
          path: `/orgs/${orgId}/${ROUTE_PATHS.DASHBOARD}`,
          icon: LayoutDashboard,
        },
        ...(showInvite
          ? [{ name: 'Invite', path: invitePath, icon: MailPlus }]
          : []),
        {
          name: 'Salon Management',
          path: `/orgs/${orgId}/${ROUTE_PATHS.SALON_MANAGEMENT}`,
          icon: Store,
        },
        {
          name: 'User Management',
          path: `/orgs/${orgId}/${ROUTE_PATHS.USER_MANAGEMENT}`,
          icon: Users,
        },
        {
          name: 'Role & Permissions',
          path: `/orgs/${orgId}/${ROUTE_PATHS.ROLES_PERMISSIONS}`,
          icon: Shield,
        },
        {
          name: 'Subscription Management',
          path: `/orgs/${orgId}/${ROUTE_PATHS.SUBSCRIPTION_MANAGEMENT}`,
          icon: CreditCard,
        },
        {
          name: 'Billing & Finance',
          path: `/orgs/${orgId}/${ROUTE_PATHS.BILLING_FINANCE}`,
          icon: Wallet,
        },
        {
          name: 'Products & Inventory',
          path: `/orgs/${orgId}/${ROUTE_PATHS.PRODUCTS_INVENTORY}`,
          icon: Boxes,
        },
        {
          name: 'Staff & HR Monitoring',
          path: `/orgs/${orgId}/${ROUTE_PATHS.STAFF_MONITORING}`,
          icon: UserCheck,
        },
        {
          name: 'Customer Analytics',
          path: `/orgs/${orgId}/${ROUTE_PATHS.CUSTOMER_ANALYTICS}`,
          icon: LineChart,
        },
        {
          name: 'Notifications & Communication',
          path: `/orgs/${orgId}/${ROUTE_PATHS.NOTIFICATIONS_COMMUNICATION}`,
          icon: Bell,
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

      <nav className="custom-scrollbar flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-6">
        {navItems.map((item) => (
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
