import React from 'react';
import { RotateCcw, XCircle } from 'lucide-react';

import { Button } from '../common';
import { INVITE_ROLE_LABELS, INVITE_STATUS } from '../../constants/invitation';
import { InviteListItem } from '../../redux/slices/invitations/Types';

interface InvitesTableProps {
  invites: InviteListItem[];
  isLoading?: boolean;
  onResend?: (id: string) => void;
  onCancel?: (id: string) => void;
  resendingId?: string | null;
  cancellingId?: string | null;
}

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  accepted: 'bg-green-100 text-green-800',
  expired: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-700',
};

const InvitesTable: React.FC<InvitesTableProps> = ({
  invites,
  isLoading,
  onResend,
  onCancel,
  resendingId,
  cancellingId,
}) => {
  if (isLoading) {
    return <p className="py-8 text-center text-sm text-gray-500">Loading invitations...</p>;
  }

  if (!invites.length) {
    return null;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Name</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Contact</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Role</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Salon</th>
            <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
            <th className="px-4 py-3 text-right font-semibold text-gray-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {invites.map((invite) => {
            const isPending = invite.status === INVITE_STATUS.PENDING;
            return (
              <tr key={invite.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{invite.full_name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {invite.login_phone
                    ? invite.login_phone
                    : invite.invited_email?.includes('.mychair.internal')
                      ? '—'
                      : invite.invited_email}
                </td>
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
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default InvitesTable;
