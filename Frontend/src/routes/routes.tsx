import { lazy } from 'react';
import { RouteObject } from 'react-router';
import { Store, Users, Shield, CreditCard, Wallet, Boxes, UserCheck, LineChart, Bell } from 'lucide-react';

import App from '../App';
import { ROLES, ROUTE_PATHS } from '../constants';
import { Login, Invite, CreatePassword, SalonOwnerLogin, SalonOwnerDashboard } from '../pages';
import OrgRedirect from './OrgRedirect';
import RequireAuth from './RequireAuth';
import RootRedirect from './RootRedirect';

// Lazy loaded pages
const NotFound = lazy(() => import('../pages').then((module) => ({ default: module.NotFound })));
const Dashboard = lazy(() => import('../pages').then((module) => ({ default: module.Dashboard })));
const Profile = lazy(() => import('../pages').then((module) => ({ default: module.Profile })));
const Settings = lazy(() => import('../pages').then((module) => ({ default: module.Settings })));
const Placeholder = lazy(() => import('../pages').then((module) => ({ default: module.Placeholder })));

const getPlaceholder = (title: string, description: string, Icon: React.ElementType) => (
  <RequireAuth allowedRoles={[ROLES.ADMIN, ROLES.USER, ROLES.SUPER_ADMIN]}>
    <OrgRedirect>
      <Placeholder title={title} description={description} icon={Icon} />
    </OrgRedirect>
  </RequireAuth>
);

const getSuperAdminPlaceholder = (title: string, description: string, Icon: React.ElementType) => (
  <RequireAuth allowedRoles={[ROLES.SUPER_ADMIN]}>
    <Placeholder title={title} description={description} icon={Icon} />
  </RequireAuth>
);

export const routes: RouteObject[] = [
  {
    path: ROUTE_PATHS.ROOT,
    element: <App />,
    children: [
      { index: true, element: <RootRedirect /> },

      // Public routes
      { path: ROUTE_PATHS.LOGIN, element: <Login /> },
      { path: ROUTE_PATHS.CREATE_PASSWORD, element: <CreatePassword /> },
      { path: ROUTE_PATHS.SALON_OWNER_LOGIN, element: <SalonOwnerLogin /> },

      // Super Admin routes (no org scope)
      {
        path: ROUTE_PATHS.ADMIN_DASHBOARD,
        element: (
          <RequireAuth allowedRoles={[ROLES.SUPER_ADMIN]}>
            <Dashboard />
          </RequireAuth>
        ),
      },
      {
        path: ROUTE_PATHS.ADMIN_INVITE,
        element: (
          <RequireAuth allowedRoles={[ROLES.SUPER_ADMIN]}>
            <Invite />
          </RequireAuth>
        ),
      },
      // Keep legacy /invite path for backward compatibility
      {
        path: ROUTE_PATHS.INVITE,
        element: (
          <RequireAuth allowedRoles={[ROLES.SUPER_ADMIN]}>
            <Invite />
          </RequireAuth>
        ),
      },
      { path: ROUTE_PATHS.ADMIN_SALON_MANAGEMENT, element: getSuperAdminPlaceholder('Salon Management', 'Oversee all salon branches, configurations, and operational settings across the platform.', Store) },
      { path: ROUTE_PATHS.ADMIN_USER_MANAGEMENT, element: getSuperAdminPlaceholder('User Management', 'Manage all platform users, salon owners, and staff accounts.', Users) },
      { path: ROUTE_PATHS.ADMIN_ROLES_PERMISSIONS, element: getSuperAdminPlaceholder('Role & Permissions', 'Configure platform-wide access levels, roles, and permission policies.', Shield) },
      { path: ROUTE_PATHS.ADMIN_SUBSCRIPTION_MANAGEMENT, element: getSuperAdminPlaceholder('Subscription Management', 'Manage SaaS subscription tiers, plan assignments, and renewals.', CreditCard) },
      { path: ROUTE_PATHS.ADMIN_BILLING_FINANCE, element: getSuperAdminPlaceholder('Billing & Finance', 'View platform-wide invoices, revenue analytics, and financial reports.', Wallet) },
      { path: ROUTE_PATHS.ADMIN_PRODUCTS_INVENTORY, element: getSuperAdminPlaceholder('Products & Inventory', 'Monitor product catalogs, inventory levels, and supplier management.', Boxes) },
      { path: ROUTE_PATHS.ADMIN_STAFF_MONITORING, element: getSuperAdminPlaceholder('Staff & HR Monitoring', 'Track staff performance, attendance, and HR metrics across all salons.', UserCheck) },
      { path: ROUTE_PATHS.ADMIN_CUSTOMER_ANALYTICS, element: getSuperAdminPlaceholder('Customer Analytics', 'Analyze customer retention, spending patterns, and engagement across the platform.', LineChart) },
      { path: ROUTE_PATHS.ADMIN_NOTIFICATIONS_COMMUNICATION, element: getSuperAdminPlaceholder('Notifications & Communication', 'Manage platform-wide notifications, campaigns, and communication channels.', Bell) },

      // Salon owner dashboard
      {
        path: ROUTE_PATHS.SALON_OWNER_DASHBOARD,
        element: (
          <RequireAuth allowedRoles={[ROLES.SALON_OWNER]}>
            <SalonOwnerDashboard />
          </RequireAuth>
        ),
      },

      // Org-based routes
      {
        path: `orgs/:orgId/${ROUTE_PATHS.DASHBOARD}`,
        element: (
          <RequireAuth allowedRoles={[ROLES.ADMIN, ROLES.USER, ROLES.SUPER_ADMIN]}>
            <OrgRedirect>
              <Dashboard />
            </OrgRedirect>
          </RequireAuth>
        ),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.PROFILE}`,
        element: (
          <RequireAuth allowedRoles={[ROLES.ADMIN, ROLES.USER, ROLES.SUPER_ADMIN]}>
            <OrgRedirect>
              <Profile />
            </OrgRedirect>
          </RequireAuth>
        ),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.SETTINGS}`,
        element: (
          <RequireAuth allowedRoles={[ROLES.ADMIN, ROLES.USER, ROLES.SUPER_ADMIN]}>
            <OrgRedirect>
              <Settings />
            </OrgRedirect>
          </RequireAuth>
        ),
      },
      
      // New Salon ERP Modules (Placeholders)
      { path: `orgs/:orgId/${ROUTE_PATHS.SALON_MANAGEMENT}`, element: getPlaceholder('Salon Management', 'Configure your salon branches, working hours, and general settings.', Store) },
      { path: `orgs/:orgId/${ROUTE_PATHS.USER_MANAGEMENT}`, element: getPlaceholder('User Management', 'Manage salon staff profiles and customer accounts.', Users) },
      { path: `orgs/:orgId/${ROUTE_PATHS.ROLES_PERMISSIONS}`, element: getPlaceholder('Role & Permissions', 'Configure system access levels and staff permissions.', Shield) },
      { path: `orgs/:orgId/${ROUTE_PATHS.SUBSCRIPTION_MANAGEMENT}`, element: getPlaceholder('Subscription Management', 'Manage your SaaS subscription plans and billing details.', CreditCard) },
      { path: `orgs/:orgId/${ROUTE_PATHS.BILLING_FINANCE}`, element: getPlaceholder('Billing & Finance', 'View invoices, POS transactions, and financial analytics.', Wallet) },
      { path: `orgs/:orgId/${ROUTE_PATHS.PRODUCTS_INVENTORY}`, element: getPlaceholder('Products & Inventory', 'Track retail products, professional stock, and suppliers.', Boxes) },
      { path: `orgs/:orgId/${ROUTE_PATHS.STAFF_MONITORING}`, element: getPlaceholder('Staff & HR Monitoring', 'Monitor staff schedules, performance metrics, and shifts.', UserCheck) },
      { path: `orgs/:orgId/${ROUTE_PATHS.CUSTOMER_ANALYTICS}`, element: getPlaceholder('Customer Analytics', 'Understand client retention, spending patterns, and behavior.', LineChart) },
      { path: `orgs/:orgId/${ROUTE_PATHS.NOTIFICATIONS_COMMUNICATION}`, element: getPlaceholder('Notifications & Communication', 'Manage SMS campaigns, email alerts, and in-app notifications.', Bell) },

      // 404
      {
        path: ROUTE_PATHS.NOT_FOUND,
        element: (
          <RequireAuth allowedRoles={[ROLES.USER, ROLES.ADMIN, ROLES.SUPER_ADMIN]}>
            <NotFound />
          </RequireAuth>
        ),
      },
      {
        path: ROUTE_PATHS.CATCH_ALL,
        element: (
          <RequireAuth allowedRoles={[ROLES.ADMIN, ROLES.USER, ROLES.SUPER_ADMIN]}>
            <NotFound />
          </RequireAuth>
        ),
      },
    ],
  },
];
