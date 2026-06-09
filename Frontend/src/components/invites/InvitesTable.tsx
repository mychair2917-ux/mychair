import React from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, Search, XCircle } from 'lucide-react';

import { Button, Input } from '../common';
import { INVITE_ROLE_LABELS, INVITE_STATUS } from '../../constants/invitation';
import { InviteListItem } from '../../redux/slices/invitations/Types';

interface InvitesTableProps {
  invites: InviteListItem[];
  isLoading?: boolean;
  isFetching?: boolean;
  onResend?: (id: string) => void;
  onCancel?: (id: string) => void;
  resendingId?: string | null;
  cancellingId?: string | null;
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  search: string;
  onSearchChange: (value: string) => void;
  emptyMessage?: string;
}

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-green-100 text-green-800',
  expired: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

function getContactDisplay(invite: InviteListItem): string {
  if (invite.login_phone) return invite.login_phone;
  const email = invite.invited_email ?? '';
  if (email.includes('.mychair.internal')) return '—';
  return email || '—';
}

const SkeletonRow: React.FC = () => (
  <tr>
    {Array.from({ length: 7 }).map((_, i) => (
      <td key={i} className="px-4 py-3">
        <div className="h-4 animate-pulse rounded bg-gray-200" />
      </td>
    ))}
  </tr>
);

const InvitesTable: React.FC<InvitesTableProps> = ({
  invites,
  isLoading,
  isFetching,
  onResend,
  onCancel,
  resendingId,
  cancellingId,
  page,
  totalPages,
  total,
  pageSize,
  onPageChange,
  search,
  onSearchChange,
  emptyMessage = 'No invitations found.',
}) => {
  const startItem = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Search bar */}
      <div className="flex items-center gap-3 border-b border-gray-100 p-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="!pl-9"
          />
        </div>
        {isFetching && !isLoading && (
          <span className="text-xs text-gray-400">Refreshing...</span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Email</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Contact</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Role</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Salon</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)
            ) : invites.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              invites.map((invite) => {
                const isPending = invite.status === INVITE_STATUS.PENDING;
                const emailDisplay = invite.invited_email?.includes('.mychair.internal')
                  ? '—'
                  : invite.invited_email || '—';
                return (
                  <tr key={invite.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">{invite.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{emailDisplay}</td>
                    <td className="px-4 py-3 text-gray-600">{getContactDisplay(invite)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {INVITE_ROLE_LABELS[invite.role] ?? invite.role}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{invite.salon_name ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${statusStyles[invite.status] ?? 'bg-gray-100 text-gray-600'}`}
                      >
                        {invite.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isPending && !invite.provisioned && onResend && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="!px-2 !py-1"
                            onClick={() => onResend(invite.id)}
                            isLoading={resendingId === invite.id}
                            disabled={!!resendingId || !!cancellingId}
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                        )}
                        {isPending && onCancel && (
                          <Button
                            type="button"
                            variant="ghost"
                            className="!px-2 !py-1 !text-red-600"
                            onClick={() => onCancel(invite.id)}
                            isLoading={cancellingId === invite.id}
                            disabled={!!resendingId || !!cancellingId}
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {(!isPending || (isPending && invite.provisioned && !onResend && !onCancel)) && (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {!isLoading && total > 0 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3">
          <p className="text-xs text-gray-500">
            Showing <span className="font-medium">{startItem}–{endItem}</span> of{' '}
            <span className="font-medium">{total}</span> invitations
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              className="!px-2 !py-1"
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1 || isFetching}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const pageNum = totalPages <= 7
                ? i + 1
                : page <= 4
                ? i + 1
                : page >= totalPages - 3
                ? totalPages - 6 + i
                : page - 3 + i;
              if (pageNum < 1 || pageNum > totalPages) return null;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  disabled={isFetching}
                  className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                    pageNum === page
                      ? 'bg-[var(--color-brand-gold)] text-white'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <Button
              type="button"
              variant="ghost"
              className="!px-2 !py-1"
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages || isFetching}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default InvitesTable;
