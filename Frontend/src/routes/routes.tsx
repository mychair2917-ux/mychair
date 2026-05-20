import { lazy } from 'react';
import { RouteObject } from 'react-router';
import { Calendar, CalendarDays, Users, ShoppingBag, Scissors, PackageOpen, Boxes, LineChart, Megaphone, Wallet, Sparkles, UserPlus } from 'lucide-react';

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
      { path: `orgs/:orgId/calendar`, element: getPlaceholder('Calendar', 'Manage your team\'s schedule visually.', Calendar) },
      { path: `orgs/:orgId/appointments`, element: getPlaceholder('Appointments', 'View and manage upcoming bookings.', CalendarDays) },
      { path: `orgs/:orgId/walk-ins`, element: getPlaceholder('Walk-ins', 'Quick registration for walk-in clients.', UserPlus) },
      { path: `orgs/:orgId/billing`, element: getPlaceholder('POS Billing', 'Fast and seamless checkout experience.', ShoppingBag) },
      { path: `orgs/:orgId/clients`, element: getPlaceholder('Clients Directory', 'Complete client history and notes.', Users) },
      { path: `orgs/:orgId/staff`, element: getPlaceholder('Staff Management', 'Schedules, performance, and attendance.', Sparkles) },
      { path: `orgs/:orgId/services`, element: getPlaceholder('Services Menu', 'Configure services, pricing, and duration.', Scissors) },
      { path: `orgs/:orgId/packages`, element: getPlaceholder('Packages & Memberships', 'Bundle services for better retention.', PackageOpen) },
      { path: `orgs/:orgId/inventory`, element: getPlaceholder('Inventory & Stock', 'Track products and get low stock alerts.', Boxes) },
      { path: `orgs/:orgId/reports`, element: getPlaceholder('Reports & Analytics', 'Insights into revenue and growth.', LineChart) },
      { path: `orgs/:orgId/crm`, element: getPlaceholder('CRM & Marketing', 'Automated reminders and campaigns.', Megaphone) },
      { path: `orgs/:orgId/payroll`, element: getPlaceholder('Payroll & Incentives', 'Staff commissions and salaries calculation.', Wallet) },

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
