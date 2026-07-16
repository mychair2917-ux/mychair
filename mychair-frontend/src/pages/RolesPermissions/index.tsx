import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search, Shield } from 'lucide-react';

import PermissionToggle from '../../components/permissions/PermissionToggle';
import { Button, CommonCard, Input, showToast } from '../../components/common';
import { ROLES } from '../../constants';
import { useListEmployeesQuery } from '../../redux/slices/employees/employeesApi';
import {
  PermissionRegistryItem,
  useGetMyPermissionsQuery,
  useGetPermissionRegistryQuery,
  useGetRolePermissionsQuery,
  useGetUserPermissionsQuery,
  useUpdateRolePermissionsMutation,
  useUpdateUserPermissionsMutation,
} from '../../redux/slices/permissions/permissionsApi';
import { useAppDispatch, useAppSelector } from '../../redux/hooks';
import { setPermissions } from '../../redux/slices/auth/authSlice';
import { cn } from '../../utils/cn';
import { getApiErrorMessage } from '../../utils/apiErrors';

const ROLE_TABS = [
  { key: ROLES.SALON_MANAGER, label: 'Manager' },
  { key: ROLES.EMPLOYEE, label: 'Staff' },
];

const RolesPermissions: React.FC = () => {
  const dispatch = useAppDispatch();
  const currentUserId = useAppSelector((state) => state.auth.user?.id);
  const [activeRoleTab, setActiveRoleTab] = useState<string>(ROLES.SALON_MANAGER);
  const [roleDraft, setRoleDraft] = useState<Record<string, boolean>>({});
  const [userDraft, setUserDraft] = useState<Record<string, boolean>>({});
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userSearch, setUserSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const { data: registryRes } = useGetPermissionRegistryQuery();
  const registry = registryRes?.data ?? [];

  const { data: roleRes, isLoading: roleLoading } = useGetRolePermissionsQuery(activeRoleTab);
  const { data: employeesRes } = useListEmployeesQuery();
  const { data: userPermRes, isLoading: userPermLoading } = useGetUserPermissionsQuery(
    selectedUserId,
    { skip: !selectedUserId }
  );

  const [updateRolePerms, { isLoading: savingRole }] = useUpdateRolePermissionsMutation();
  const [updateUserPerms, { isLoading: savingUser }] = useUpdateUserPermissionsMutation();
  const { refetch: refetchMyPerms } = useGetMyPermissionsQuery();

  const employees = employeesRes?.data ?? [];
  const manageableUsers = useMemo(
    () =>
      employees.filter(
        (e) => e.role === ROLES.SALON_MANAGER || e.role === ROLES.EMPLOYEE
      ),
    [employees]
  );

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return manageableUsers;
    return manageableUsers.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
    );
  }, [manageableUsers, userSearch]);

  useEffect(() => {
    if (roleRes?.data) {
      setRoleDraft({ ...roleRes.data.defaults, ...roleRes.data.overrides });
    }
  }, [roleRes]);

  useEffect(() => {
    if (userPermRes?.data) {
      setUserDraft({ ...userPermRes.data.defaults, ...userPermRes.data.overrides });
    }
  }, [userPermRes]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const refreshCurrentUserPermissions = async () => {
    const result = await refetchMyPerms();
    if (result.data?.data?.permissions) {
      dispatch(setPermissions(result.data.data.permissions));
    }
  };

  const handleSaveRole = async () => {
    const overrides: Record<string, boolean> = {};
    const defaults = roleRes?.data?.defaults ?? {};
    Object.entries(roleDraft).forEach(([key, value]) => {
      if (defaults[key] !== value) {
        overrides[key] = value;
      }
    });

    try {
      await updateRolePerms({ role: activeRoleTab, permissions: overrides }).unwrap();
      showToast('success', 'Role permissions saved');
      if (currentUserId) {
        await refreshCurrentUserPermissions();
      }
    } catch (error) {
      showToast('error', getApiErrorMessage(error, 'Failed to save role permissions'));
    }
  };

  const handleSaveUser = async () => {
    if (!selectedUserId) return;
    const overrides: Record<string, boolean> = {};
    const defaults = userPermRes?.data?.defaults ?? {};
    Object.entries(userDraft).forEach(([key, value]) => {
      if (defaults[key] !== value) {
        overrides[key] = value;
      }
    });

    try {
      await updateUserPerms({ userId: selectedUserId, permissions: overrides }).unwrap();
      showToast('success', 'User permissions saved');
      if (selectedUserId === currentUserId) {
        await refreshCurrentUserPermissions();
      }
    } catch (error) {
      showToast('error', getApiErrorMessage(error, 'Failed to save user permissions'));
    }
  };

  const renderRegistryItems = (
    items: PermissionRegistryItem[],
    draft: Record<string, boolean>,
    onToggle: (key: string, value: boolean) => void,
    defaults?: Record<string, boolean>
  ) => (
    <div className="space-y-3">
      {items.map((item) => {
        const hasChildren = item.children && item.children.length > 0;
        const isOpen = expandedGroups[item.key] ?? hasChildren;

        if (hasChildren) {
          return (
            <div key={item.key} className="rounded-2xl border border-[var(--color-border-soft)]">
              <button
                type="button"
                onClick={() => toggleGroup(item.key)}
                className="flex w-full items-center justify-between px-4 py-3 text-left"
              >
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {item.label}
                </span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 text-[var(--color-text-secondary)] transition-transform',
                    isOpen && 'rotate-180'
                  )}
                />
              </button>
              {isOpen && (
                <div className="space-y-2 border-t border-[var(--color-border-soft)] p-3">
                  <PermissionToggle
                    label={item.label}
                    checked={Boolean(draft[item.key])}
                    onChange={(v) => onToggle(item.key, v)}
                    hint={
                      defaults && draft[item.key] !== defaults[item.key]
                        ? 'Custom override'
                        : undefined
                    }
                  />
                  {item.children?.map((child) => (
                    <PermissionToggle
                      key={child.key}
                      label={child.label}
                      checked={Boolean(draft[child.key])}
                      onChange={(v) => onToggle(child.key, v)}
                      hint={
                        defaults && draft[child.key] !== defaults[child.key]
                          ? 'Custom override'
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          );
        }

        return (
          <PermissionToggle
            key={item.key}
            label={item.label}
            checked={Boolean(draft[item.key])}
            onChange={(v) => onToggle(item.key, v)}
            hint={
              defaults && draft[item.key] !== defaults[item.key] ? 'Custom override' : undefined
            }
          />
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-gold)] text-white">
          <Shield className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
            Role & Permissions
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Configure default access for roles and override permissions for individual staff.
          </p>
        </div>
      </div>

      <CommonCard
        title="Role Permission Templates"
        subtitle="Set default module access for Manager and Staff roles."
        loading={roleLoading}
      >
        <div className="mb-4 flex flex-wrap gap-2">
          {ROLE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveRoleTab(tab.key)}
              className={cn(
                'rounded-full px-4 py-2 text-sm font-medium transition-colors',
                activeRoleTab === tab.key
                  ? 'bg-[var(--color-brand-gold)] text-white'
                  : 'bg-gray-100 text-[var(--color-text-secondary)] hover:bg-gray-200'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {renderRegistryItems(
          registry,
          roleDraft,
          (key, value) => setRoleDraft((prev) => ({ ...prev, [key]: value })),
          roleRes?.data?.defaults
        )}

        <div className="mt-6 flex justify-end border-t border-[var(--color-border-soft)] pt-4">
          <Button onClick={handleSaveRole} disabled={savingRole}>
            {savingRole ? 'Saving...' : 'Save Role Template'}
          </Button>
        </div>
      </CommonCard>

      <CommonCard
        title="Individual User Permissions"
        subtitle="Override permissions for a specific manager or staff member."
        loading={userPermLoading && Boolean(selectedUserId)}
      >
        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search staff or manager..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => setSelectedUserId(user.id)}
                className={cn(
                  'rounded-xl border px-3 py-2 text-left text-sm transition-colors',
                  selectedUserId === user.id
                    ? 'border-[var(--color-brand-gold)] bg-amber-50'
                    : 'border-[var(--color-border-soft)] hover:border-gray-300'
                )}
              >
                <span className="font-medium">{user.full_name}</span>
                <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                  {user.role.replace(/_/g, ' ')}
                </span>
              </button>
            ))}
          </div>
        </div>

        {selectedUserId && userPermRes?.data ? (
          <>
            <div className="mb-4 rounded-xl bg-gray-50 px-4 py-3 text-sm text-[var(--color-text-secondary)]">
              Showing overrides for{' '}
              <span className="font-medium text-[var(--color-text-primary)]">
                {filteredUsers.find((u) => u.id === selectedUserId)?.full_name ?? 'User'}
              </span>
              . Toggles reflect role defaults plus any custom changes.
            </div>
            {renderRegistryItems(
              registry,
              userDraft,
              (key, value) => setUserDraft((prev) => ({ ...prev, [key]: value })),
              userPermRes.data.defaults
            )}
            <div className="mt-6 flex justify-end border-t border-[var(--color-border-soft)] pt-4">
              <Button onClick={handleSaveUser} disabled={savingUser}>
                {savingUser ? 'Saving...' : 'Save User Permissions'}
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Select a staff or manager user to customize their access.
          </p>
        )}
      </CommonCard>
    </div>
  );
};

export default RolesPermissions;
