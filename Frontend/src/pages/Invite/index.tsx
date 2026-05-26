import React, { useMemo, useState } from 'react';
import { MailPlus, UserPlus } from 'lucide-react';
import { Navigate } from 'react-router-dom';

import { Button } from '../../components/common';
import { showToast } from '../../components/common/Toast/toastService';
import InviteFormModal from '../../components/invites/InviteFormModal';
import InvitesTable from '../../components/invites/InvitesTable';
import { INVITE_STATUS } from '../../constants/invitation';
import { ROUTE_PATHS } from '../../constants';
import { useAppSelector } from '../../redux/hooks';
import {
  useCancelInvitationMutation,
  useCreateInvitationMutation,
  useGetInvitationFormOptionsQuery,
  useListInvitesQuery,
  useResendInvitationMutation,
} from '../../redux/slices/invitations/invitationsApi';
import { CreateInviteRequest } from '../../redux/slices/invitations/Types';
import { canUserInvite } from '../../utils/invitePermissions';
import { getApiErrorMessage } from '../../utils/apiErrors';

const Invite: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data: listData, isLoading: isLoadingList } = useListInvitesQuery();
  const { data: formOptionsData, isLoading: isLoadingOptions } =
    useGetInvitationFormOptionsQuery(undefined, { skip: !isModalOpen });

  const [createInvitation, { isLoading: isCreating }] = useCreateInvitationMutation();
  const [resendInvitation] = useResendInvitationMutation();
  const [cancelInvitation] = useCancelInvitationMutation();

  const allInvites = listData?.data ?? [];

  const pendingInvites = useMemo(
    () => allInvites.filter((i) => i.status === INVITE_STATUS.PENDING),
    [allInvites]
  );

  const acceptedInvites = useMemo(
    () => allInvites.filter((i) => i.status === INVITE_STATUS.ACCEPTED),
    [allInvites]
  );

  if (!canUserInvite(user?.role)) {
    return <Navigate to={`/${ROUTE_PATHS.NOT_FOUND}`} replace />;
  }

  const handleCreate = async (payload: CreateInviteRequest) => {
    const response = await createInvitation(payload).unwrap();
    return {
      success: response.success,
      message: response.message,
    };
  };

  const handleResend = async (inviteId: string) => {
    setResendingId(inviteId);
    try {
      const response = await resendInvitation({ invite_id: inviteId }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Invitation resent');
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to resend invitation'));
    } finally {
      setResendingId(null);
    }
  };

  const handleCancel = async (inviteId: string) => {
    setCancellingId(inviteId);
    try {
      const response = await cancelInvitation({ invite_id: inviteId }).unwrap();
      if (response.success) {
        showToast('success', response.message || 'Invitation cancelled');
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to cancel invitation'));
    } finally {
      setCancellingId(null);
    }
  };

  const hasAnyInvites = allInvites.length > 0;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] md:text-3xl">
            Invite Users
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Invite salon owners by email, or create manager/staff accounts with a login
            password (no email required for your team).
          </p>
        </div>
        <Button
          variant="primary"
          className="!bg-[var(--color-brand-gold)] hover:!bg-[var(--color-brand-gold-dark)] !px-6"
          onClick={() => setIsModalOpen(true)}
        >
          <UserPlus className="h-4 w-4" />
          Invite User
        </Button>
      </div>

      {!hasAnyInvites && !isLoadingList && (
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-brand-gold)]/10">
              <MailPlus className="h-8 w-8 text-[var(--color-brand-gold)]" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">No invitations yet</h2>
            <p className="mt-2 max-w-md text-sm text-gray-500">
              Invite salon owners, managers, or staff. They will receive an email to set their
              password and activate their account.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-8">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Pending Invitations</h2>
          {pendingInvites.length > 0 || isLoadingList ? (
            <InvitesTable
              invites={pendingInvites}
              isLoading={isLoadingList}
              onResend={handleResend}
              onCancel={handleCancel}
              resendingId={resendingId}
              cancellingId={cancellingId}
            />
          ) : (
            <p className="text-sm text-gray-500">No pending invitations.</p>
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-800">Accepted Invitations</h2>
          {acceptedInvites.length > 0 || isLoadingList ? (
            <InvitesTable invites={acceptedInvites} isLoading={isLoadingList} />
          ) : (
            <p className="text-sm text-gray-500">No accepted invitations yet.</p>
          )}
        </section>
      </div>

      <InviteFormModal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        inviterRole={user?.role ?? ''}
        formOptions={formOptionsData?.data}
        isLoadingOptions={isLoadingOptions}
        onSubmit={handleCreate}
        isSubmitting={isCreating}
      />
    </div>
  );
};

export default Invite;
