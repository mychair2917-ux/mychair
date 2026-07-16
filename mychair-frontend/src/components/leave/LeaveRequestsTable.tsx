import React from 'react';
import { Check, X } from 'lucide-react';

import { Button, CommonChips } from '../common';
import { LEAVE_STATUS, LeaveRequestItem } from '../../redux/slices/leave/Types';
import { formatDateDMY } from '../../utils/utilities';
import { formatTime12h } from '../attendance/attendanceUtils';

const statusTone: Record<string, 'warning' | 'success' | 'error' | 'default'> = {
  [LEAVE_STATUS.PENDING]: 'warning',
  [LEAVE_STATUS.APPROVED]: 'success',
  [LEAVE_STATUS.REJECTED]: 'error',
};

const formatRoleLabel = (role: string): string =>
  role.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

const formatCreatedAt = (value: string): string => {
  const date = formatDateDMY(value);
  const time = formatTime12h(value);
  if (date === '---' || time === '---') return '---';
  return `${date}, ${time}`;
};

interface LeaveRequestsTableProps {
  items: LeaveRequestItem[];
  loading?: boolean;
  showEmployee?: boolean;
  showActions?: boolean;
  variant?: 'cards' | 'table';
  onApprove?: (leaveId: string) => void;
  onReject?: (leaveId: string) => void;
  approvingId?: string | null;
  rejectingId?: string | null;
  emptyTitle?: string;
  emptyDescription?: string;
}

const LeaveRequestsTable: React.FC<LeaveRequestsTableProps> = ({
  items,
  loading = false,
  showEmployee = false,
  showActions = false,
  variant = 'cards',
  onApprove,
  onReject,
  approvingId,
  rejectingId,
  emptyTitle = 'No leave requests',
  emptyDescription = 'There are no leave requests to display yet.',
}) => {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-24 animate-pulse rounded-2xl bg-[var(--color-surface-muted)]" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--color-border-soft)] bg-[var(--color-surface-muted)]/40 px-6 py-10 text-center">
        <p className="text-base font-semibold text-gray-900">{emptyTitle}</p>
        <p className="mt-2 text-sm text-gray-500">{emptyDescription}</p>
      </div>
    );
  }

  if (variant === 'table' && showEmployee) {
    return (
      <div className="overflow-x-auto rounded-2xl border border-[var(--color-border-soft)]">
        <table className="min-w-full divide-y divide-[var(--color-border-soft)] text-sm">
          <thead className="bg-[var(--color-surface-muted)]/60">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Employee</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Leave Date</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Reason</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Requested</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-700">Status</th>
              {showActions && (
                <th className="px-4 py-3 text-right font-semibold text-gray-700">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--color-border-soft)] bg-white">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50/80">
                <td className="px-4 py-4 font-medium text-gray-900">{item.employee_name}</td>
                <td className="px-4 py-4 text-gray-600">{formatRoleLabel(item.employee_role)}</td>
                <td className="px-4 py-4 text-gray-700">{formatDateDMY(item.leave_date)}</td>
                <td className="max-w-xs px-4 py-4 text-gray-700">
                  <span className="line-clamp-2">{item.leave_reason}</span>
                </td>
                <td className="px-4 py-4 whitespace-nowrap text-gray-600">
                  {formatCreatedAt(item.created_at)}
                </td>
                <td className="px-4 py-4">
                  <CommonChips
                    label={item.status.replace(/_/g, ' ')}
                    status={statusTone[item.status] ?? 'default'}
                  />
                </td>
                {showActions && (
                  <td className="px-4 py-4">
                    {item.status === LEAVE_STATUS.PENDING ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          onClick={() => onApprove?.(item.id)}
                          isLoading={approvingId === item.id}
                          disabled={Boolean(approvingId || rejectingId)}
                        >
                          <Check className="mr-1 h-4 w-4" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          onClick={() => onReject?.(item.id)}
                          isLoading={rejectingId === item.id}
                          disabled={Boolean(approvingId || rejectingId)}
                        >
                          <X className="mr-1 h-4 w-4" />
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-2xl border border-[var(--color-border-soft)] bg-white p-4 shadow-sm"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                {showEmployee && (
                  <p className="text-base font-semibold text-gray-900">{item.employee_name}</p>
                )}
                <CommonChips
                  label={item.status.replace(/_/g, ' ')}
                  status={statusTone[item.status] ?? 'default'}
                />
                {showEmployee && (
                  <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                    {formatRoleLabel(item.employee_role)}
                  </span>
                )}
              </div>
              <div className="grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
                <p>
                  <span className="font-medium text-gray-800">Leave Date:</span>{' '}
                  {formatDateDMY(item.leave_date)}
                </p>
                <p>
                  <span className="font-medium text-gray-800">Requested:</span>{' '}
                  {formatCreatedAt(item.created_at)}
                </p>
              </div>
              <p className="text-sm text-gray-700">
                <span className="font-medium text-gray-800">Reason:</span> {item.leave_reason}
              </p>
              {item.rejection_reason && (
                <p className="text-sm text-rose-600">
                  <span className="font-medium">Rejection reason:</span> {item.rejection_reason}
                </p>
              )}
            </div>

            {showActions && item.status === LEAVE_STATUS.PENDING && (
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() => onApprove?.(item.id)}
                  isLoading={approvingId === item.id}
                  disabled={Boolean(approvingId || rejectingId)}
                >
                  <Check className="mr-1 h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => onReject?.(item.id)}
                  isLoading={rejectingId === item.id}
                  disabled={Boolean(approvingId || rejectingId)}
                >
                  <X className="mr-1 h-4 w-4" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LeaveRequestsTable;
