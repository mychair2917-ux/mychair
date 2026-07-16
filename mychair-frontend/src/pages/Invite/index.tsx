import React, { useState } from 'react';
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

const PAGE_SIZE = 10;

const Invite: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  // Pagination state for each table
  const [pendingPage, setPendingPage] = useState(1);
  const [acceptedPage, setAcceptedPage] = useState(1);
  const [pendingSearch, setPendingSearch] = useState('');
  const [acceptedSearch, setAcceptedSearch] = useState('');

  const {
    data: pendingData,
    isLoading: isLoadingPending,
    isFetching: isFetchingPending,
    isError: isPendingError,
    refetch: refetchPending,
  } = useListInvitesQuery({
    status: INVITE_STATUS.PENDING,
    page: pendingPage,
    limit: PAGE_SIZE,
    search: pendingSearch || undefined,
  });

  const {
    data: acceptedData,
    isLoading: isLoadingAccepted,
    isFetching: isFetchingAccepted,
    isError: isAcceptedError,
    refetch: refetchAccepted,
  } = useListInvitesQuery({
    status: INVITE_STATUS.ACCEPTED,
    page: acceptedPage,
    limit: PAGE_SIZE,
    search: acceptedSearch || undefined,
  });

  const { data: formOptionsData, isLoading: isLoadingOptions } =
    useGetInvitationFormOptionsQuery(undefined, { skip: !isModalOpen });

  const [createInvitation, { isLoading: isCreating }] = useCreateInvitationMutation();
  const [resendInvitation] = useResendInvitationMutation();
  const [cancelInvitation] = useCancelInvitationMutation();

  const pendingInvites = pendingData?.data?.items ?? [];
  const pendingTotal = pendingData?.data?.total ?? 0;
  const pendingPages = pendingData?.data?.pages ?? 1;

  const acceptedInvites = acceptedData?.data?.items ?? [];
  const acceptedTotal = acceptedData?.data?.total ?? 0;
  const acceptedPages = acceptedData?.data?.pages ?? 1;

  const hasAnyPending = pendingTotal > 0;
  const hasAnyAccepted = acceptedTotal > 0;

  if (!canUserInvite(user?.role)) {
    return <Navigate to={`/${ROUTE_PATHS.NOT_FOUND}`} replace />;
  }

  const handleCreate = async (payload: CreateInviteRequest) => {
    try {
      const response = await createInvitation(payload).unwrap();
      return {
        success: response.success ?? true,
        message: response.message,
      };
    } catch (err: unknown) {
      throw err;
    }
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

  const isInitialEmpty =
    !isLoadingPending &&
    !isLoadingAccepted &&
    !hasAnyPending &&
    !hasAnyAccepted &&
    !pendingSearch &&
    !acceptedSearch;

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] md:text-3xl">
            Invite Users
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Invite salon owners via email, or add managers and staff with email and password.
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

      {isInitialEmpty && (
        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-brand-gold)]/10">
              <MailPlus className="h-8 w-8 text-[var(--color-brand-gold)]" />
            </div>
            <h2 className="text-lg font-semibold text-gray-800">No invitations yet</h2>
            <p className="mt-2 max-w-md text-sm text-gray-500">
              Invite salon owners, managers, or staff. Salon owners receive an email to set their
              password. Managers and staff get an account created immediately with the password you
              provide.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-8">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            Pending Invitations
            {pendingTotal > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2.5 py-0.5 text-sm font-medium text-amber-800">
                {pendingTotal}
              </span>
            )}
          </h2>
          {isPendingError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Failed to load pending invitations.{' '}
              <button
                type="button"
                className="underline"
                onClick={() => refetchPending()}
              >
                Retry
              </button>
            </div>
          )}
          {!isPendingError && (
            <InvitesTable
              invites={pendingInvites}
              isLoading={isLoadingPending}
              isFetching={isFetchingPending}
              onResend={handleResend}
              onCancel={handleCancel}
              resendingId={resendingId}
              cancellingId={cancellingId}
              page={pendingPage}
              totalPages={pendingPages}
              total={pendingTotal}
              pageSize={PAGE_SIZE}
              onPageChange={setPendingPage}
              search={pendingSearch}
              onSearchChange={(val) => {
                setPendingSearch(val);
                setPendingPage(1);
              }}
              emptyMessage="No pending invitations."
            />
          )}
        </section>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-800">
            Accepted Invitations
            {acceptedTotal > 0 && (
              <span className="ml-2 rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-800">
                {acceptedTotal}
              </span>
            )}
          </h2>
          {isAcceptedError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Failed to load accepted invitations.{' '}
              <button
                type="button"
                className="underline"
                onClick={() => refetchAccepted()}
              >
                Retry
              </button>
            </div>
          )}
          {!isAcceptedError && (
            <InvitesTable
              invites={acceptedInvites}
              isLoading={isLoadingAccepted}
              isFetching={isFetchingAccepted}
              page={acceptedPage}
              totalPages={acceptedPages}
              total={acceptedTotal}
              pageSize={PAGE_SIZE}
              onPageChange={setAcceptedPage}
              search={acceptedSearch}
              onSearchChange={(val) => {
                setAcceptedSearch(val);
                setAcceptedPage(1);
              }}
              emptyMessage="No accepted invitations yet."
            />
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
