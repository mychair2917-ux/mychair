import {
  Bell,
  Boxes,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  LineChart,
  MailPlus,
  Shield,
  Store,
  UserCheck,
  Users,
  Wallet,
} from 'lucide-react';
import type { ElementType } from 'react';

import { ROLES, ROUTE_PATHS } from '../constants';

/** Application modules aligned with backend RBAC. */
export const MODULES = {
  DASHBOARD: 'dashboard',
  INVITE: 'invite',
  APPOINTMENTS: 'appointments',
  SALON_MANAGEMENT: 'salon_management',
  EMPLOYEES: 'employees',
  SERVICES: 'services',
  USER_MANAGEMENT: 'user_management',
  ROLES_PERMISSIONS: 'roles_permissions',
  SUBSCRIPTION_MANAGEMENT: 'subscription_management',
  BILLING_FINANCE: 'billing_finance',
  PRODUCTS_INVENTORY: 'products_inventory',
  STAFF_MONITORING: 'staff_monitoring',
  CUSTOMER_ANALYTICS: 'customer_analytics',
  NOTIFICATIONS_COMMUNICATION: 'notifications_communication',
  PROFILE: 'profile',
  SETTINGS: 'settings',
} as const;

export type ModuleKey = (typeof MODULES)[keyof typeof MODULES];

const ALL_MODULES: ModuleKey[] = Object.values(MODULES);

const ROLE_ALIASES: Record<string, string> = {
  admin: ROLES.SALON_ADMIN,
  standard: ROLES.EMPLOYEE,
};

/** Module access per role (mirrors backend ROLE_MODULE_ACCESS). */
const ROLE_MODULE_ACCESS: Record<string, readonly ModuleKey[]> = {
  [ROLES.SUPER_ADMIN]: ALL_MODULES,
  [ROLES.SALON_OWNER]: ALL_MODULES.filter((m) => m !== MODULES.SUBSCRIPTION_MANAGEMENT),
  [ROLES.SALON_ADMIN]: ALL_MODULES.filter(
    (m) => m !== MODULES.SUBSCRIPTION_MANAGEMENT && m !== MODULES.EMPLOYEES
  ),
  [ROLES.SALON_MANAGER]: [
    MODULES.DASHBOARD,
    MODULES.INVITE,
    MODULES.APPOINTMENTS,
    MODULES.SALON_MANAGEMENT,
    MODULES.SERVICES,
    MODULES.PRODUCTS_INVENTORY,
    MODULES.NOTIFICATIONS_COMMUNICATION,
  ],
  [ROLES.EMPLOYEE]: [
    MODULES.DASHBOARD,
    MODULES.APPOINTMENTS,
    MODULES.SALON_MANAGEMENT,
    MODULES.SERVICES,
    MODULES.PROFILE,
    MODULES.SETTINGS,
  ],
};

export function normalizeRole(role: string | undefined): string | undefined {
  if (!role) return undefined;
  return ROLE_ALIASES[role] ?? role;
}

export function canAccessModule(role: string | undefined, module: ModuleKey): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  const allowed = ROLE_MODULE_ACCESS[normalized];
  return allowed?.includes(module) ?? false;
}

export function isSuperAdmin(role: string | undefined): boolean {
  return normalizeRole(role) === ROLES.SUPER_ADMIN;
}

export function isTenantScopedRole(role: string | undefined): boolean {
  const normalized = normalizeRole(role);
  return (
    normalized === ROLES.SALON_OWNER ||
    normalized === ROLES.SALON_ADMIN ||
    normalized === ROLES.SALON_MANAGER ||
    normalized === ROLES.EMPLOYEE
  );
}

export function canAccessTenant(
  role: string | undefined,
  userTenantId: string | null | undefined,
  routeOrgId: string | undefined
): boolean {
  if (!routeOrgId) return true;
  if (isSuperAdmin(role)) return true;
  return Boolean(userTenantId && userTenantId === routeOrgId);
}

export function showSalonBranchSelector(role: string | undefined): boolean {
  return isSuperAdmin(role);
}

export function isEmployeeDashboard(role: string | undefined): boolean {
  return normalizeRole(role) === ROLES.EMPLOYEE;
}

export interface SidebarNavChild {
  name: string;
  module: ModuleKey;
  path: string;
}

export interface SidebarNavItem {
  name: string;
  module: ModuleKey;
  path?: string;
  icon: ElementType;
  badge?: string;
  children?: SidebarNavChild[];
}

function orgPath(orgId: string, segment: string): string {
  return `/orgs/${orgId}/${segment}`;
}

function salonManagementChildren(
  role: string | undefined,
  employeesPath: string,
  servicesPath: string
): SidebarNavChild[] {
  const children: SidebarNavChild[] = [];
  if (canAccessModule(role, MODULES.EMPLOYEES)) {
    children.push({ name: 'Employees', module: MODULES.EMPLOYEES, path: employeesPath });
  }
  if (canAccessModule(role, MODULES.SERVICES)) {
    children.push({ name: 'Manage Salon', module: MODULES.SERVICES, path: servicesPath });
  }
  return children;
}

function financeChildren(basePath: string): SidebarNavChild[] {
  return [
    { name: 'Bills', module: MODULES.BILLING_FINANCE, path: `${basePath}/bills` },
    { name: 'Payroll', module: MODULES.BILLING_FINANCE, path: `${basePath}/payroll` },
    { name: 'Expenses', module: MODULES.BILLING_FINANCE, path: `${basePath}/expenses` },
    { name: 'Purchasing', module: MODULES.BILLING_FINANCE, path: `${basePath}/purchasing` },
    { name: 'Payments', module: MODULES.BILLING_FINANCE, path: `${basePath}/payments` },
    { name: 'Reports', module: MODULES.BILLING_FINANCE, path: `${basePath}/reports` },
  ];
}

export function isPlatformTenantId(tenantId: string | null | undefined): boolean {
  return !tenantId || tenantId === 'system';
}

export function resolveEmployeeListTenantId(
  role: string | undefined,
  routeOrgId: string | undefined,
  storedOrgId: string | null | undefined
): string | undefined {
  const candidate = routeOrgId ?? storedOrgId ?? undefined;
  if (isPlatformTenantId(candidate)) {
    return isSuperAdmin(role) ? undefined : candidate;
  }
  return candidate;
}

/** Build sidebar navigation for the current user context. */
export function getSidebarNavItems(
  role: string | undefined,
  orgId: string | undefined
): SidebarNavItem[] {
  const normalized = normalizeRole(role);
  if (!normalized) return [];

  const allItems: SidebarNavItem[] = isSuperAdmin(role)
    ? [
        {
          name: 'Dashboard',
          module: MODULES.DASHBOARD,
          path: `/${ROUTE_PATHS.ADMIN_DASHBOARD}`,
          icon: LayoutDashboard,
        },
        {
          name: 'Invite',
          module: MODULES.INVITE,
          path: `/${ROUTE_PATHS.ADMIN_INVITE}`,
          icon: MailPlus,
        },
        {
          name: 'Appointments',
          module: MODULES.APPOINTMENTS,
          path: `/${ROUTE_PATHS.ADMIN_APPOINTMENTS}`,
          icon: CalendarDays,
        },
        {
          name: 'Salon Management',
          module: MODULES.SALON_MANAGEMENT,
          icon: Store,
          children: salonManagementChildren(
            role,
            `/${ROUTE_PATHS.ADMIN_SALON_EMPLOYEES}`,
            `/${ROUTE_PATHS.ADMIN_SALON_SERVICES}`
          ),
        },
        {
          name: 'User Management',
          module: MODULES.USER_MANAGEMENT,
          path: `/${ROUTE_PATHS.ADMIN_USER_MANAGEMENT}`,
          icon: Users,
        },
        {
          name: 'Role & Permissions',
          module: MODULES.ROLES_PERMISSIONS,
          path: `/${ROUTE_PATHS.ADMIN_ROLES_PERMISSIONS}`,
          icon: Shield,
        },
        {
          name: 'Subscription Management',
          module: MODULES.SUBSCRIPTION_MANAGEMENT,
          path: `/${ROUTE_PATHS.ADMIN_SUBSCRIPTION_MANAGEMENT}`,
          icon: CreditCard,
        },
        {
          name: 'Billing & Finance',
          module: MODULES.BILLING_FINANCE,
          path: `/${ROUTE_PATHS.ADMIN_BILLING_FINANCE}`,
          icon: Wallet,
          children: financeChildren(`/${ROUTE_PATHS.ADMIN_BILLING_FINANCE}`),
        },
        {
          name: 'Products & Inventory',
          module: MODULES.PRODUCTS_INVENTORY,
          path: `/${ROUTE_PATHS.ADMIN_PRODUCTS_INVENTORY}`,
          icon: Boxes,
        },
        {
          name: 'Staff & HR Monitoring',
          module: MODULES.STAFF_MONITORING,
          path: `/${ROUTE_PATHS.ADMIN_STAFF_MONITORING}`,
          icon: UserCheck,
        },
        {
          name: 'Customer Analytics',
          module: MODULES.CUSTOMER_ANALYTICS,
          path: `/${ROUTE_PATHS.ADMIN_CUSTOMER_ANALYTICS}`,
          icon: LineChart,
        },
        {
          name: 'Notifications & Communication',
          module: MODULES.NOTIFICATIONS_COMMUNICATION,
          path: `/${ROUTE_PATHS.ADMIN_NOTIFICATIONS_COMMUNICATION}`,
          icon: Bell,
        },
      ]
    : orgId
      ? [
          {
            name: 'Dashboard',
            module: MODULES.DASHBOARD,
            path: orgPath(orgId, ROUTE_PATHS.DASHBOARD),
            icon: LayoutDashboard,
          },
          {
            name: 'Invite',
            module: MODULES.INVITE,
            path:
              normalized === ROLES.SALON_OWNER
                ? `/${ROUTE_PATHS.SALON_INVITE}`
                : orgPath(orgId, ROUTE_PATHS.ORG_INVITE),
            icon: MailPlus,
          },
          {
            name: 'Appointments',
            module: MODULES.APPOINTMENTS,
            path: orgPath(orgId, ROUTE_PATHS.APPOINTMENTS),
            icon: CalendarDays,
          },
          {
            name: 'Salon Management',
            module: MODULES.SALON_MANAGEMENT,
            icon: Store,
            children: salonManagementChildren(
              role,
              orgPath(orgId, ROUTE_PATHS.SALON_EMPLOYEES),
              orgPath(orgId, ROUTE_PATHS.SALON_SERVICES)
            ),
          },
          {
            name: 'User Management',
            module: MODULES.USER_MANAGEMENT,
            path: orgPath(orgId, ROUTE_PATHS.USER_MANAGEMENT),
            icon: Users,
          },
          {
            name: 'Role & Permissions',
            module: MODULES.ROLES_PERMISSIONS,
            path: orgPath(orgId, ROUTE_PATHS.ROLES_PERMISSIONS),
            icon: Shield,
          },
          {
            name: 'Subscription Management',
            module: MODULES.SUBSCRIPTION_MANAGEMENT,
            path: orgPath(orgId, ROUTE_PATHS.SUBSCRIPTION_MANAGEMENT),
            icon: CreditCard,
          },
          {
            name: 'Billing & Finance',
            module: MODULES.BILLING_FINANCE,
            path: orgPath(orgId, ROUTE_PATHS.BILLING_FINANCE),
            icon: Wallet,
          children: financeChildren(orgPath(orgId, ROUTE_PATHS.BILLING_FINANCE)),
          },
          {
            name: 'Products & Inventory',
            module: MODULES.PRODUCTS_INVENTORY,
            path: orgPath(orgId, ROUTE_PATHS.PRODUCTS_INVENTORY),
            icon: Boxes,
          },
          {
            name: 'Staff & HR Monitoring',
            module: MODULES.STAFF_MONITORING,
            path: orgPath(orgId, ROUTE_PATHS.STAFF_MONITORING),
            icon: UserCheck,
          },
          {
            name: 'Customer Analytics',
            module: MODULES.CUSTOMER_ANALYTICS,
            path: orgPath(orgId, ROUTE_PATHS.CUSTOMER_ANALYTICS),
            icon: LineChart,
          },
          {
            name: 'Notifications & Communication',
            module: MODULES.NOTIFICATIONS_COMMUNICATION,
            path: orgPath(orgId, ROUTE_PATHS.NOTIFICATIONS_COMMUNICATION),
            icon: Bell,
          },
        ]
      : [];

  return allItems
    .map((item) => {
      if (item.children?.length) {
        const visibleChildren = item.children.filter((child) =>
          canAccessModule(role, child.module)
        );
        if (!visibleChildren.length) return null;
        return { ...item, children: visibleChildren };
      }
      if (!item.path) return null;
      return item;
    })
    .filter((item): item is SidebarNavItem => item !== null && canAccessModule(role, item.module));
}

/** Map org route segments to RBAC modules for route guards. */
export const ORG_ROUTE_MODULE: Record<string, ModuleKey> = {
  [ROUTE_PATHS.DASHBOARD]: MODULES.DASHBOARD,
  [ROUTE_PATHS.APPOINTMENTS]: MODULES.APPOINTMENTS,
  [ROUTE_PATHS.PROFILE]: MODULES.PROFILE,
  [ROUTE_PATHS.SETTINGS]: MODULES.SETTINGS,
  [ROUTE_PATHS.SALON_MANAGEMENT]: MODULES.SALON_MANAGEMENT,
  [ROUTE_PATHS.SALON_EMPLOYEES]: MODULES.EMPLOYEES,
  [ROUTE_PATHS.SALON_SERVICES]: MODULES.SERVICES,
  [ROUTE_PATHS.ORG_INVITE]: MODULES.INVITE,
  [ROUTE_PATHS.USER_MANAGEMENT]: MODULES.USER_MANAGEMENT,
  [ROUTE_PATHS.ROLES_PERMISSIONS]: MODULES.ROLES_PERMISSIONS,
  [ROUTE_PATHS.SUBSCRIPTION_MANAGEMENT]: MODULES.SUBSCRIPTION_MANAGEMENT,
  [ROUTE_PATHS.BILLING_FINANCE]: MODULES.BILLING_FINANCE,
  [ROUTE_PATHS.PRODUCTS_INVENTORY]: MODULES.PRODUCTS_INVENTORY,
  [ROUTE_PATHS.STAFF_MONITORING]: MODULES.STAFF_MONITORING,
  [ROUTE_PATHS.CUSTOMER_ANALYTICS]: MODULES.CUSTOMER_ANALYTICS,
  [ROUTE_PATHS.NOTIFICATIONS_COMMUNICATION]: MODULES.NOTIFICATIONS_COMMUNICATION,
};

export const ADMIN_ROUTE_MODULE: Record<string, ModuleKey> = {
  [ROUTE_PATHS.ADMIN_DASHBOARD]: MODULES.DASHBOARD,
  [ROUTE_PATHS.ADMIN_INVITE]: MODULES.INVITE,
  [ROUTE_PATHS.ADMIN_APPOINTMENTS]: MODULES.APPOINTMENTS,
  [ROUTE_PATHS.INVITE]: MODULES.INVITE,
  [ROUTE_PATHS.ADMIN_SALON_MANAGEMENT]: MODULES.SALON_MANAGEMENT,
  [ROUTE_PATHS.ADMIN_SALON_EMPLOYEES]: MODULES.EMPLOYEES,
  [ROUTE_PATHS.ADMIN_SALON_SERVICES]: MODULES.SERVICES,
  [ROUTE_PATHS.ADMIN_USER_MANAGEMENT]: MODULES.USER_MANAGEMENT,
  [ROUTE_PATHS.ADMIN_ROLES_PERMISSIONS]: MODULES.ROLES_PERMISSIONS,
  [ROUTE_PATHS.ADMIN_SUBSCRIPTION_MANAGEMENT]: MODULES.SUBSCRIPTION_MANAGEMENT,
  [ROUTE_PATHS.ADMIN_BILLING_FINANCE]: MODULES.BILLING_FINANCE,
  [ROUTE_PATHS.ADMIN_PRODUCTS_INVENTORY]: MODULES.PRODUCTS_INVENTORY,
  [ROUTE_PATHS.ADMIN_STAFF_MONITORING]: MODULES.STAFF_MONITORING,
  [ROUTE_PATHS.ADMIN_CUSTOMER_ANALYTICS]: MODULES.CUSTOMER_ANALYTICS,
  [ROUTE_PATHS.ADMIN_NOTIFICATIONS_COMMUNICATION]: MODULES.NOTIFICATIONS_COMMUNICATION,
};
