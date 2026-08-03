import React, { useMemo, useState } from 'react';
import { CheckCircle2, Filter, Search, UserCheck, X } from 'lucide-react';
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

const getInitials = (name: string): string => {
  if (!name) return 'ST';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.substring(0, 2).toUpperCase();
};

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
    auth.selectedSalonId ?? auth.orgId
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
    return [
      { value: '', label: 'All Branches' },
      ...Array.from(names).sort().map((name) => ({ value: name, label: name })),
    ];
  }, [employees]);

  const filteredEmployees = useMemo(
    () =>
      employees.filter((employee) =>
        branchFilter ? employee.branch_name === branchFilter : true
      ),
    [employees, branchFilter]
  );

  const handleResetFilters = () => {
    setSearch('');
    setRoleFilter('');
    setBranchFilter('');
  };

  const hasActiveFilters = Boolean(search || roleFilter || branchFilter);

  return (
    <CommonCard
      title="Staff Directory & Attendance Selector"
      subtitle="Search and select a staff member to view individual attendance summary and history"
      className="!shadow-soft"
    >
      <div className="space-y-5 p-1 sm:p-2">
        {/* Filters bar */}
        <div className="rounded-3xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
              <Filter className="h-3.5 w-3.5 text-[var(--color-brand-gold)]" />
              Filter Staff
            </span>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 text-xs font-semibold text-[var(--color-brand-gold-dark)] hover:underline transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Reset Filters
              </button>
            )}
          </div>
          <div className="grid gap-3.5 md:grid-cols-3">
            <FormField label="Search Staff" name="employee_search">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="employee_search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Name, email, or phone..."
                  className="pl-9.5 rounded-2xl border-[var(--color-border-soft)] bg-white"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </FormField>

            <FormField label="Role Filter" name="role_filter">
              <Select
                id="role_filter"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                options={roleOptions}
                className="rounded-2xl border-[var(--color-border-soft)] bg-white"
              />
            </FormField>

            <FormField label="Branch Filter" name="branch_filter">
              <Select
                id="branch_filter"
                value={branchFilter}
                onChange={(event) => setBranchFilter(event.target.value)}
                options={branches}
                className="rounded-2xl border-[var(--color-border-soft)] bg-white"
              />
            </FormField>
          </div>
        </div>

        {/* Directory Results */}
        {isLoading ? (
          <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, idx) => (
              <div
                key={idx}
                className="h-24 animate-pulse rounded-3xl border border-[var(--color-border-soft)] bg-white p-4"
              />
            ))}
          </div>
        ) : !filteredEmployees.length ? (
          <div className="rounded-3xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] py-10 px-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)]">
              <UserCheck className="h-6 w-6" />
            </div>
            <h4 className="mt-3 text-sm font-bold text-[var(--color-text-primary)]">No staff members found</h4>
            <p className="mt-1 text-xs text-[var(--color-text-secondary)] max-w-md mx-auto">
              No active staff matching your search criteria. Try modifying your search or reset filters.
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 inline-flex items-center gap-1.5 rounded-2xl border border-[var(--color-border-strong)] bg-white px-3.5 py-1.5 text-xs font-semibold text-[var(--color-text-primary)] shadow-xs hover:bg-[var(--color-surface-bg)]"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3.5 md:grid-cols-2 lg:grid-cols-3">
            {filteredEmployees.map((employee) => {
              const isSelected = selectedEmployee?.id === employee.id;
              const initials = getInitials(employee.full_name);
              return (
                <button
                  key={employee.id}
                  type="button"
                  onClick={() => onSelect(isSelected ? null : employee)}
                  className={cn(
                    'group relative flex items-start gap-3.5 rounded-3xl border p-4 text-left transition-all duration-200 focus:outline-none',
                    isSelected
                      ? 'border-[var(--color-brand-gold)] bg-[var(--color-surface-muted)] shadow-card ring-1 ring-[var(--color-brand-gold)]/40'
                      : 'border-[var(--color-border-soft)] bg-white hover:border-[var(--color-brand-gold-light)] hover:shadow-soft'
                  )}
                >
                  {/* Avatar */}
                  <div
                    className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-bold transition-transform duration-200 group-hover:scale-105',
                      isSelected
                        ? 'bg-[var(--color-brand-gold)] text-white shadow-xs'
                        : 'bg-[var(--color-surface-muted)] text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)]'
                    )}
                  >
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">{employee.full_name}</p>
                      {isSelected && (
                        <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-[var(--color-brand-gold-dark)]" />
                      )}
                    </div>
                    <p className="truncate text-xs text-[var(--color-text-secondary)]">{employee.email}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-700 uppercase tracking-wider">
                        {employee.role.replace('_', ' ')}
                      </span>
                      {employee.branch_name && (
                        <span className="rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)] truncate max-w-[120px]">
                          {employee.branch_name}
                        </span>
                      )}
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
