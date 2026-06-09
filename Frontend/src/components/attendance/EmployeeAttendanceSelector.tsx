import React, { useMemo, useState } from 'react';
import { Search, UserRound } from 'lucide-react';
import { useSelector } from 'react-redux';

import { ROLES } from '../../constants';
import { useListEmployeesQuery } from '../../redux/slices/employees/employeesApi';
import type { EmployeeListItem } from '../../redux/slices/employees/Types';
import type { RootState } from '../../redux/store';
import { resolveEmployeeListTenantId } from '../../config/rbac';
import { cn } from '../../utils/cn';
import { CommonCard, FormField, Input, Select } from '../common';

interface EmployeeAttendanceSelectorProps {
  selectedEmployee: EmployeeListItem | null;
  onSelect: (employee: EmployeeListItem | null) => void;
}

const roleOptions = [
  { value: '', label: 'All Roles' },
  { value: ROLES.SALON_MANAGER, label: 'Manager' },
  { value: ROLES.EMPLOYEE, label: 'Staff' },
];

const EmployeeAttendanceSelector: React.FC<EmployeeAttendanceSelectorProps> = ({
  selectedEmployee,
  onSelect,
}) => {
  const auth = useSelector((state: RootState) => state.auth);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');

  const tenantId = resolveEmployeeListTenantId(
    auth.user?.role,
    undefined,
    auth.selectedSalonId ?? auth.user?.tenant_id
  );

  const { data, isLoading } = useListEmployeesQuery({
    tenant_id: tenantId,
    search: search || undefined,
    role: roleFilter || undefined,
    status: 'ACTIVE',
  });

  const employees = data?.data ?? [];

  const branches = useMemo(() => {
    const names = new Set<string>();
    employees.forEach((employee) => {
      if (employee.branch_name) names.add(employee.branch_name);
    });
    return [{ value: '', label: 'All Branches' }, ...Array.from(names).sort().map((name) => ({ value: name, label: name }))];
  }, [employees]);

  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) =>
        branchFilter ? employee.branch_name === branchFilter : true
      ),
    [employees, branchFilter]
  );

  return (
    <CommonCard
      title="Select Employee"
      subtitle="Search and choose an employee to view attendance"
    >
      <div className="space-y-4 p-5">
        <div className="grid gap-3 lg:grid-cols-3">
          <FormField label="Search" name="employee_search">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="employee_search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Name, email, or phone"
                className="pl-9"
              />
            </div>
          </FormField>
          <FormField label="Role" name="role_filter">
            <Select
              id="role_filter"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              options={roleOptions}
            />
          </FormField>
          <FormField label="Branch" name="branch_filter">
            <Select
              id="branch_filter"
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              options={branches}
            />
          </FormField>
        </div>

        {isLoading ? (
          <div className="h-32 animate-pulse rounded-2xl bg-[var(--color-surface-muted)]" />
        ) : !filteredEmployees.length ? (
          <p className="rounded-2xl border border-dashed border-[var(--color-border-soft)] px-4 py-8 text-center text-sm text-gray-500">
            No employees found. Try a different search or filter.
          </p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {filteredEmployees.map((employee) => {
              const isSelected = selectedEmployee?.id === employee.id;
              return (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => onSelect(isSelected ? null : employee)}
                  className={cn(
                    'rounded-2xl border px-4 py-4 text-left transition',
                    isSelected
                      ? 'border-[var(--color-brand-gold)] bg-amber-50/60 shadow-soft'
                      : 'border-[var(--color-border-soft)] bg-white hover:border-[var(--color-brand-gold)]/50'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-[var(--color-surface-muted)] p-2 text-[var(--color-brand-gold)]">
                      <UserRound className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">{employee.full_name}</p>
                      <p className="truncate text-sm text-gray-500">{employee.email}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {employee.role.replace('_', ' ')}
                        {employee.branch_name ? ` • ${employee.branch_name}` : ''}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </CommonCard>
  );
};

export default EmployeeAttendanceSelector;
