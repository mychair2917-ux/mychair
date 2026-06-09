export const EMPLOYEE_ROLE_LABELS: Record<string, string> = {
  salon_manager: 'Manager',
  employee: 'Staff',
};

export const EMPLOYEE_ROLE_FILTER_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'salon_manager', label: 'Manager' },
  { value: 'employee', label: 'Staff' },
];

export const EMPLOYEE_STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'INACTIVE', label: 'Inactive' },
];
