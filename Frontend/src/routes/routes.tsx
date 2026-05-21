import { lazy } from 'react';
import { RouteObject } from 'react-router';
import { Store, Users, Shield, CreditCard, Wallet, Boxes, UserCheck, LineChart, Bell } from 'lucide-react';

import App from '../App';
import { ROLES, ROUTE_PATHS } from '../constants';
import { Login } from '../pages';
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

export const routes: RouteObject[] = [
  {
    path: ROUTE_PATHS.ROOT,
    element: <App />,
    children: [
      { index: true, element: <RootRedirect /> },

      // Public routes
      { path: ROUTE_PATHS.LOGIN, element: <Login /> },

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
