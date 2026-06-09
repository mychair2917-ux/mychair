import React, { useMemo, useState } from 'react';
import { Eye, KeyRound, Pencil, UserCog } from 'lucide-react';
import { Navigate, useParams } from 'react-router-dom';

import { Button, Input, Select } from '../../../components/common';
import { showToast } from '../../../components/common/Toast/toastService';
import EmployeeEditModal from '../../../components/employees/EmployeeEditModal';
import EmployeeResetPasswordModal from '../../../components/employees/EmployeeResetPasswordModal';
import EmployeeViewModal from '../../../components/employees/EmployeeViewModal';
import {
  MODULES,
  canAccessModule,
  isSuperAdmin,
  resolveEmployeeListTenantId,
} from '../../../config/rbac';
import {
  EMPLOYEE_ROLE_FILTER_OPTIONS,
  EMPLOYEE_ROLE_LABELS,
  EMPLOYEE_STATUS_FILTER_OPTIONS,
} from '../../../constants/employees';
import { ROUTE_PATHS } from '../../../constants';
import { useAppSelector } from '../../../redux/hooks';
import {
  useListEmployeesQuery,
  useResetEmployeePasswordMutation,
  useUpdateEmployeeMutation,
  useUpdateEmployeeStatusMutation,
} from '../../../redux/slices/employees/employeesApi';
import { EmployeeListItem } from '../../../redux/slices/employees/Types';
import { getApiErrorMessage } from '../../../utils/apiErrors';

const statusStyles: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  INACTIVE: 'bg-gray-100 text-gray-600',
};

const Employees: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const user = useAppSelector((state) => state.auth.user);
  const storedOrgId = useAppSelector((state) => state.auth.orgId);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId);
  const effectiveStoredOrgId = isSuperAdmin(user?.role) ? selectedSalonId ?? storedOrgId : storedOrgId;
  const employeeTenantId = resolveEmployeeListTenantId(user?.role, orgId, effectiveStoredOrgId);

  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [viewEmployee, setViewEmployee] = useState<EmployeeListItem | null>(null);
  const [editEmployee, setEditEmployee] = useState<EmployeeListItem | null>(null);
  const [resetEmployee, setResetEmployee] = useState<EmployeeListItem | null>(null);

  if (!canAccessModule(user?.role, MODULES.EMPLOYEES)) {
    return <Navigate to={`/${ROUTE_PATHS.NOT_FOUND}`} replace />;
  }

  const listParams = useMemo(
    () => ({
      ...(employeeTenantId ? { tenant_id: employeeTenantId } : {}),
      ...(roleFilter ? { role: roleFilter } : {}),
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(search ? { search } : {}),
    }),
    [employeeTenantId, roleFilter, statusFilter, search]
  );

  const { data, isLoading, isFetching } = useListEmployeesQuery(listParams);
  const [updateEmployee, { isLoading: isUpdating }] = useUpdateEmployeeMutation();
  const [updateStatus, { isLoading: isToggling }] = useUpdateEmployeeStatusMutation();
  const [resetPassword, { isLoading: isResetting }] = useResetEmployeePasswordMutation();

  const employees = data?.data ?? [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput.trim());
  };

  const handleToggleStatus = async (employee: EmployeeListItem) => {
    try {
      const response = await updateStatus({
        id: employee.id,
        body: { is_active: !employee.is_active },
      }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Status updated');
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to update status'));
    }
  };

  const handleEditSubmit = async (payload: {
    first_name: string;
    last_name: string;
    phone: string;
    role: string;
    branch_name: string;
    weekly_off: string[];
  }) => {
    if (!editEmployee) return;
    try {
      const response = await updateEmployee({ id: editEmployee.id, body: payload }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Employee updated');
        setEditEmployee(null);
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to update employee'));
    }
  };

  const handleResetPassword = async (password: string, confirmPassword: string) => {
    if (!resetEmployee) return;
    try {
      const response = await resetPassword({
        id: resetEmployee.id,
        body: { password, confirm_password: confirmPassword },
      }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Password reset');
        setResetEmployee(null);
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to reset password'));
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] md:text-3xl">
          Employees
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Managers and staff only (salon owners are not listed here). Super admin platform
          accounts are excluded.
          {isSuperAdmin(user?.role) && !employeeTenantId && (
            <> Showing employees across all salons.</>
          )}
        </p>
      </div>

      <div className="mb-6 flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:items-end">
        <form onSubmit={handleSearch} className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-gray-600">Search</label>
            <Input
              placeholder="Name or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" className="!bg-[var(--color-brand-gold)] sm:mb-0">
            Search
          </Button>
        </form>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:w-auto">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Role</label>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              options={EMPLOYEE_ROLE_FILTER_OPTIONS}
              placeholder="All roles"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Status</label>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={EMPLOYEE_STATUS_FILTER_OPTIONS}
              placeholder="All statuses"
            />
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading || isFetching ? (
          <p className="py-12 text-center text-sm text-gray-500">Loading employees...</p>
        ) : employees.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">No employees found.</p>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Full Name</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Role</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Phone</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Branch</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Created</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {employees.map((employee) => (
                <tr key={employee.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{employee.full_name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {EMPLOYEE_ROLE_LABELS[employee.role] ?? employee.role}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{employee.email}</td>
                  <td className="px-4 py-3 text-gray-600">{employee.phone || '-'}</td>
                  <td className="px-4 py-3 text-gray-600">{employee.branch_name || '-'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyles[employee.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {employee.status.toLowerCase()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {new Date(employee.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="!px-2"
                        title="View"
                        onClick={() => setViewEmployee(employee)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="!px-2"
                        title="Edit"
                        onClick={() => setEditEmployee(employee)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="!px-2"
                        title={employee.is_active ? 'Disable' : 'Enable'}
                        onClick={() => handleToggleStatus(employee)}
                        isLoading={isToggling}
                        disabled={isToggling}
                      >
                        <UserCog className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        className="!px-2"
                        title="Reset password"
                        onClick={() => setResetEmployee(employee)}
                      >
                        <KeyRound className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <EmployeeViewModal
        open={!!viewEmployee}
        employee={viewEmployee}
        onClose={() => setViewEmployee(null)}
      />
      <EmployeeEditModal
        open={!!editEmployee}
        employee={editEmployee}
        onClose={() => setEditEmployee(null)}
        onSubmit={handleEditSubmit}
        isSubmitting={isUpdating}
      />
      <EmployeeResetPasswordModal
        open={!!resetEmployee}
        employee={resetEmployee}
        onClose={() => setResetEmployee(null)}
        onSubmit={handleResetPassword}
        isSubmitting={isResetting}
      />
    </div>
  );
};

export default Employees;
