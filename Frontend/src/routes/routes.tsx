import React, { lazy } from 'react';
import { RouteObject } from 'react-router';
import { Users, Shield, CreditCard, Boxes, UserCheck, LineChart, Bell } from 'lucide-react';

import App from '../App';
import { MODULES } from '../config/rbac';
import { ROLES, ROUTE_PATHS } from '../constants';
import { Login, Invite, CreatePassword, SalonOwnerLogin } from '../pages';
import OrgRedirect from './OrgRedirect';
import ProtectedRoute from './ProtectedRoute';
import RootRedirect from './RootRedirect';
import SalonOwnerRedirect from './SalonOwnerRedirect';

const NotFound = lazy(() => import('../pages').then((module) => ({ default: module.NotFound })));
const Dashboard = lazy(() => import('../pages').then((module) => ({ default: module.Dashboard })));
const Profile = lazy(() => import('../pages').then((module) => ({ default: module.Profile })));
const Settings = lazy(() => import('../pages').then((module) => ({ default: module.Settings })));
const Placeholder = lazy(() => import('../pages').then((module) => ({ default: module.Placeholder })));
const Employees = lazy(() =>
  import('../pages').then((module) => ({ default: module.Employees }))
);
const Services = lazy(() =>
  import('../pages').then((module) => ({ default: module.Services }))
);
const Appointments = lazy(() =>
  import('../pages').then((module) => ({ default: module.Appointments }))
);
const MyEarnings = lazy(() =>
  import('../pages').then((module) => ({ default: module.MyEarnings }))
);
const BillingFinance = lazy(() =>
  import('../pages').then((module) => ({ default: module.BillingFinance }))
);
const CustomerAnalytics = lazy(() =>
  import('../pages').then((module) => ({ default: module.CustomerAnalytics }))
);

const protectOrg = (module: (typeof MODULES)[keyof typeof MODULES], element: React.ReactNode) => (
  <ProtectedRoute module={module}>
    <OrgRedirect>{element as React.ReactElement}</OrgRedirect>
  </ProtectedRoute>
);

const protectAdmin = (module: (typeof MODULES)[keyof typeof MODULES], element: React.ReactNode) => (
  <ProtectedRoute module={module} superAdminOnly>
    {element as React.ReactElement}
  </ProtectedRoute>
);

const orgPlaceholder = (module: (typeof MODULES)[keyof typeof MODULES], title: string, description: string, Icon: React.ElementType) =>
  protectOrg(module, <Placeholder title={title} description={description} icon={Icon} />);

const adminPlaceholder = (module: (typeof MODULES)[keyof typeof MODULES], title: string, description: string, Icon: React.ElementType) =>
  protectAdmin(module, <Placeholder title={title} description={description} icon={Icon} />);

export const routes: RouteObject[] = [
  {
    path: ROUTE_PATHS.ROOT,
    element: <App />,
    children: [
      { index: true, element: <RootRedirect /> },

      { path: ROUTE_PATHS.LOGIN, element: <Login /> },
      { path: ROUTE_PATHS.CREATE_PASSWORD, element: <CreatePassword /> },
      { path: ROUTE_PATHS.SALON_OWNER_LOGIN, element: <SalonOwnerLogin /> },

      {
        path: ROUTE_PATHS.ADMIN_DASHBOARD,
        element: protectAdmin(MODULES.DASHBOARD, <Dashboard />),
      },
      {
        path: ROUTE_PATHS.ADMIN_PROFILE,
        element: protectAdmin(MODULES.PROFILE, <Profile />),
      },
      {
        path: ROUTE_PATHS.ADMIN_SETTINGS,
        element: protectAdmin(MODULES.SETTINGS, <Settings />),
      },
      {
        path: ROUTE_PATHS.ADMIN_INVITE,
        element: (
          <ProtectedRoute module={MODULES.INVITE} superAdminOnly>
            <Invite />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTE_PATHS.ADMIN_APPOINTMENTS,
        element: protectAdmin(MODULES.APPOINTMENTS, <Appointments />),
      },
      {
        path: ROUTE_PATHS.ADMIN_MY_EARNINGS,
        element: protectAdmin(MODULES.MY_EARNINGS, <MyEarnings />),
      },
      {
        path: ROUTE_PATHS.INVITE,
        element: (
          <ProtectedRoute module={MODULES.INVITE} superAdminOnly>
            <Invite />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTE_PATHS.SALON_INVITE,
        element: (
          <ProtectedRoute module={MODULES.INVITE} allowedRoles={[ROLES.SALON_OWNER]}>
            <Invite />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTE_PATHS.SALON_OWNER_DASHBOARD,
        element: (
          <ProtectedRoute module={MODULES.DASHBOARD} allowedRoles={[ROLES.SALON_OWNER]}>
            <SalonOwnerRedirect />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTE_PATHS.ADMIN_SALON_EMPLOYEES,
        element: protectAdmin(MODULES.EMPLOYEES, <Employees />),
      },
      {
        path: ROUTE_PATHS.ADMIN_SALON_SERVICES,
        element: protectAdmin(MODULES.SERVICES, <Services />),
      },
      {
        path: ROUTE_PATHS.ADMIN_USER_MANAGEMENT,
        element: adminPlaceholder(
          MODULES.USER_MANAGEMENT,
          'User Management',
          'Manage all platform users, salon owners, and staff accounts.',
          Users
        ),
      },
      {
        path: ROUTE_PATHS.ADMIN_ROLES_PERMISSIONS,
        element: adminPlaceholder(
          MODULES.ROLES_PERMISSIONS,
          'Role & Permissions',
          'Configure platform-wide access levels, roles, and permission policies.',
          Shield
        ),
      },
      {
        path: ROUTE_PATHS.ADMIN_SUBSCRIPTION_MANAGEMENT,
        element: adminPlaceholder(
          MODULES.SUBSCRIPTION_MANAGEMENT,
          'Subscription Management',
          'Manage SaaS subscription tiers, plan assignments, and renewals.',
          CreditCard
        ),
      },
      {
        path: ROUTE_PATHS.ADMIN_BILLING_FINANCE,
        element: protectAdmin(MODULES.BILLING_FINANCE, <BillingFinance />),
      },
      {
        path: `${ROUTE_PATHS.ADMIN_BILLING_FINANCE}/:financeSection`,
        element: protectAdmin(MODULES.BILLING_FINANCE, <BillingFinance />),
      },
      {
        path: ROUTE_PATHS.ADMIN_PRODUCTS_INVENTORY,
        element: adminPlaceholder(
          MODULES.PRODUCTS_INVENTORY,
          'Products & Inventory',
          'Monitor product catalogs, inventory levels, and supplier management.',
          Boxes
        ),
      },
      {
        path: ROUTE_PATHS.ADMIN_STAFF_MONITORING,
        element: adminPlaceholder(
          MODULES.STAFF_MONITORING,
          'Staff & HR Monitoring',
          'Track staff performance, attendance, and HR metrics across all salons.',
          UserCheck
        ),
      },
      {
        path: ROUTE_PATHS.ADMIN_CUSTOMER_ANALYTICS,
        element: protectAdmin(MODULES.CUSTOMER_ANALYTICS, <CustomerAnalytics />),
      },
      {
        path: ROUTE_PATHS.ADMIN_NOTIFICATIONS_COMMUNICATION,
        element: adminPlaceholder(
          MODULES.NOTIFICATIONS_COMMUNICATION,
          'Notifications & Communication',
          'Manage platform-wide notifications, campaigns, and communication channels.',
          Bell
        ),
      },

      {
        path: `orgs/:orgId/${ROUTE_PATHS.DASHBOARD}`,
        element: protectOrg(MODULES.DASHBOARD, <Dashboard />),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.PROFILE}`,
        element: protectOrg(MODULES.PROFILE, <Profile />),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.SETTINGS}`,
        element: protectOrg(MODULES.SETTINGS, <Settings />),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.SALON_EMPLOYEES}`,
        element: protectOrg(MODULES.EMPLOYEES, <Employees />),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.SALON_SERVICES}`,
        element: protectOrg(MODULES.SERVICES, <Services />),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.ORG_INVITE}`,
        element: protectOrg(MODULES.INVITE, <Invite />),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.APPOINTMENTS}`,
        element: protectOrg(MODULES.APPOINTMENTS, <Appointments />),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.MY_EARNINGS}`,
        element: protectOrg(MODULES.MY_EARNINGS, <MyEarnings />),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.USER_MANAGEMENT}`,
        element: orgPlaceholder(
          MODULES.USER_MANAGEMENT,
          'User Management',
          'Manage salon staff profiles and customer accounts.',
          Users
        ),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.ROLES_PERMISSIONS}`,
        element: orgPlaceholder(
          MODULES.ROLES_PERMISSIONS,
          'Role & Permissions',
          'Configure system access levels and staff permissions.',
          Shield
        ),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.SUBSCRIPTION_MANAGEMENT}`,
        element: orgPlaceholder(
          MODULES.SUBSCRIPTION_MANAGEMENT,
          'Subscription Management',
          'Manage your SaaS subscription plans and billing details.',
          CreditCard
        ),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.BILLING_FINANCE}`,
        element: protectOrg(MODULES.BILLING_FINANCE, <BillingFinance />),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.BILLING_FINANCE}/:financeSection`,
        element: protectOrg(MODULES.BILLING_FINANCE, <BillingFinance />),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.PRODUCTS_INVENTORY}`,
        element: orgPlaceholder(
          MODULES.PRODUCTS_INVENTORY,
          'Products & Inventory',
          'Track retail products, professional stock, and suppliers.',
          Boxes
        ),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.STAFF_MONITORING}`,
        element: orgPlaceholder(
          MODULES.STAFF_MONITORING,
          'Staff & HR Monitoring',
          'Monitor staff schedules, performance metrics, and shifts.',
          UserCheck
        ),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.CUSTOMER_ANALYTICS}`,
        element: protectOrg(MODULES.CUSTOMER_ANALYTICS, <CustomerAnalytics />),
      },
      {
        path: `orgs/:orgId/${ROUTE_PATHS.NOTIFICATIONS_COMMUNICATION}`,
        element: orgPlaceholder(
          MODULES.NOTIFICATIONS_COMMUNICATION,
          'Notifications & Communication',
          'Manage SMS campaigns, email alerts, and in-app notifications.',
          Bell
        ),
      },

      {
        path: ROUTE_PATHS.NOT_FOUND,
        element: (
          <ProtectedRoute>
            <NotFound />
          </ProtectedRoute>
        ),
      },
      {
        path: ROUTE_PATHS.CATCH_ALL,
        element: (
          <ProtectedRoute>
            <NotFound />
          </ProtectedRoute>
        ),
      },
    ],
  },
];
