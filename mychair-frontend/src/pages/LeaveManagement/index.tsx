import React, { useMemo, useState } from 'react';
import { CalendarPlus, Filter } from 'lucide-react';
import { Navigate } from 'react-router-dom';

import LeaveApplyModal from '../../components/leave/LeaveApplyModal';
import LeaveRejectModal from '../../components/leave/LeaveRejectModal';
import LeaveRequestsTable from '../../components/leave/LeaveRequestsTable';
import {
  Button,
  CommonCard,
  CommonPagination,
  CommonSearch,
  Input,
  Select,
} from '../../components/common';
import { showToast } from '../../components/common/Toast/toastService';
import {
  canAccessModule,
  canApproveLeave,
  MODULES,
  resolveEmployeeListTenantId,
  resolveLeaveHistoryScope,
} from '../../config/rbac';
import { LEAVE_STATUS } from '../../redux/slices/leave/Types';
import { ROUTE_PATHS } from '../../constants';
import { useAppSelector } from '../../redux/hooks';
import { useListEmployeesQuery } from '../../redux/slices/employees/employeesApi';
import {
  useApplyLeaveMutation,
  useApproveLeaveMutation,
  useListLeaveRequestsQuery,
  useListPendingLeaveQuery,
  useRejectLeaveMutation,
} from '../../redux/slices/leave/leaveApi';
import { getApiErrorMessage } from '../../utils/apiErrors';

const PAGE_SIZE = 10;

const LeaveManagement: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);
  const permissions = useAppSelector((state) => state.auth.permissions);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId);
  const orgId = useAppSelector((state) => state.auth.orgId);

  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [rejectLeaveId, setRejectLeaveId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);

  const [pendingPage, setPendingPage] = useState(1);
  const [myPage, setMyPage] = useState(1);
  const [historyPage, setHistoryPage] = useState(1);
  const [pendingSearch, setPendingSearch] = useState('');
  const [mySearch, setMySearch] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyStatus, setHistoryStatus] = useState<string>('');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [historyEmployeeId, setHistoryEmployeeId] = useState('');

  const canApprove = canApproveLeave(user?.role);
  const historyScope = resolveLeaveHistoryScope(user?.role);
  const showEmployeeFilter = historyScope !== 'my';

  const employeeTenantId = resolveEmployeeListTenantId(
    user?.role,
    undefined,
    selectedSalonId ?? orgId
  );

  const { data: employeesData } = useListEmployeesQuery(
    {
      tenant_id: employeeTenantId,
      status: 'ACTIVE',
    },
    { skip: !showEmployeeFilter }
  );

  const employeeOptions = useMemo(() => {
    const employees = employeesData?.data ?? [];
    return [
      { value: '', label: 'All employees' },
      ...employees.map((employee) => ({
        value: employee.id,
        label: employee.full_name,
      })),
    ];
  }, [employeesData?.data]);

  const pendingQuery = useListPendingLeaveQuery(
    {
      page: pendingPage,
      limit: PAGE_SIZE,
      search: pendingSearch || undefined,
      salon_id: selectedSalonId || undefined,
    },
    { skip: !canApprove }
  );

  const myQuery = useListLeaveRequestsQuery({
    page: myPage,
    limit: PAGE_SIZE,
    search: mySearch || undefined,
    scope: 'my',
    salon_id: selectedSalonId || undefined,
  });

  const historyQuery = useListLeaveRequestsQuery({
    page: historyPage,
    limit: PAGE_SIZE,
    search: historySearch || undefined,
    scope: historyScope,
    status: historyStatus ? (historyStatus as typeof LEAVE_STATUS.PENDING) : undefined,
    date_from: historyDateFrom || undefined,
    date_to: historyDateTo || undefined,
    employee_id: historyEmployeeId || undefined,
    salon_id: selectedSalonId || undefined,
    history_only: !historyStatus,
  });

  const [applyLeave, { isLoading: isApplying }] = useApplyLeaveMutation();
  const [approveLeave] = useApproveLeaveMutation();
  const [rejectLeave, { isLoading: isRejecting }] = useRejectLeaveMutation();

  const rejectTarget = useMemo(
    () => pendingQuery.data?.data?.items.find((item) => item.id === rejectLeaveId),
    [pendingQuery.data?.data?.items, rejectLeaveId]
  );

  if (!canAccessModule(user?.role, MODULES.LEAVE, permissions)) {
    return <Navigate to={`/${ROUTE_PATHS.NOT_FOUND}`} replace />;
  }

  const handleApply = async (payload: { leave_date: string; leave_reason: string }) => {
    try {
      const response = await applyLeave(payload).unwrap();
      showToast('success', response.message || 'Leave request submitted');
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to submit leave request'));
      throw err;
    }
  };

  const handleApprove = async (leaveId: string) => {
    setApprovingId(leaveId);
    try {
      const response = await approveLeave(leaveId).unwrap();
      showToast('success', response.message || 'Leave approved');
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to approve leave'));
    } finally {
      setApprovingId(null);
    }
  };

  const handleRejectConfirm = async (rejectionReason: string) => {
    if (!rejectLeaveId) return;
    setRejectingId(rejectLeaveId);
    try {
      const response = await rejectLeave({
        leaveId: rejectLeaveId,
        body: { rejection_reason: rejectionReason || undefined },
      }).unwrap();
      showToast('success', response.message || 'Leave rejected');
      setRejectLeaveId(null);
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to reject leave'));
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 md:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leave</h1>
          <p className="mt-1 text-sm text-gray-500">
            {canApprove
              ? 'Review pending team leave requests, apply for your own leave, and track salon history.'
              : 'Apply for leave and track your request status.'}
          </p>
        </div>
        <Button onClick={() => setIsApplyOpen(true)}>
          <CalendarPlus className="mr-2 h-4 w-4" />
          Apply Leave
        </Button>
      </div>

      {canApprove && (
        <CommonCard
          title="Pending Leave Requests"
          subtitle="Newest requests first — approve or reject employee leave"
        >
          <div className="mb-4">
            <CommonSearch
              placeholder="Search pending requests..."
              onDebouncedChange={(value) => {
                setPendingSearch(value);
                setPendingPage(1);
              }}
            />
          </div>
          <LeaveRequestsTable
            items={pendingQuery.data?.data?.items ?? []}
            loading={pendingQuery.isLoading || pendingQuery.isFetching}
            showEmployee
            showActions
            variant="table"
            onApprove={handleApprove}
            onReject={setRejectLeaveId}
            approvingId={approvingId}
            rejectingId={rejectingId}
            emptyTitle="No pending leave requests"
            emptyDescription="All caught up — there are no pending leave requests right now."
          />
          {(pendingQuery.data?.data?.total ?? 0) > PAGE_SIZE && (
            <div className="mt-4">
              <CommonPagination
                page={pendingPage}
                pageSize={PAGE_SIZE}
                totalItems={pendingQuery.data?.data?.total ?? 0}
                onPageChange={setPendingPage}
              />
            </div>
          )}
        </CommonCard>
      )}

      <CommonCard title="My Leave Requests" subtitle="Track your submitted leave applications">
        <div className="mb-4">
          <CommonSearch
            placeholder="Search my requests..."
            onDebouncedChange={(value) => {
              setMySearch(value);
              setMyPage(1);
            }}
          />
        </div>
        <LeaveRequestsTable
          items={myQuery.data?.data?.items ?? []}
          loading={myQuery.isLoading || myQuery.isFetching}
          emptyTitle="No leave requests yet"
          emptyDescription="Use Apply Leave to submit your first request."
        />
        {(myQuery.data?.data?.total ?? 0) > PAGE_SIZE && (
          <div className="mt-4">
            <CommonPagination
              page={myPage}
              pageSize={PAGE_SIZE}
              totalItems={myQuery.data?.data?.total ?? 0}
              onPageChange={setMyPage}
            />
          </div>
        )}
      </CommonCard>

      <CommonCard
        title="Leave History"
        subtitle={
          historyScope === 'my'
            ? 'Your approved and rejected leave records'
            : 'Historical approved and rejected leave records'
        }
      >
        <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_auto_auto_auto_auto_auto]">
          <CommonSearch
            placeholder="Search history..."
            onDebouncedChange={(value) => {
              setHistorySearch(value);
              setHistoryPage(1);
            }}
          />
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Filter className="h-4 w-4" />
            Filters
          </div>
          {showEmployeeFilter && (
            <Select
              value={historyEmployeeId}
              onChange={(event) => {
                setHistoryEmployeeId(event.target.value);
                setHistoryPage(1);
              }}
              options={employeeOptions}
            />
          )}
          <Input
            type="date"
            value={historyDateFrom}
            onChange={(event) => {
              setHistoryDateFrom(event.target.value);
              setHistoryPage(1);
            }}
          />
          <Input
            type="date"
            value={historyDateTo}
            onChange={(event) => {
              setHistoryDateTo(event.target.value);
              setHistoryPage(1);
            }}
          />
          <select
            value={historyStatus}
            onChange={(event) => {
              setHistoryStatus(event.target.value);
              setHistoryPage(1);
            }}
            className="rounded-xl border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm"
          >
            <option value="">Approved & Rejected</option>
            <option value={LEAVE_STATUS.APPROVED}>Approved</option>
            <option value={LEAVE_STATUS.REJECTED}>Rejected</option>
          </select>
        </div>
        <LeaveRequestsTable
          items={historyQuery.data?.data?.items ?? []}
          loading={historyQuery.isLoading || historyQuery.isFetching}
          showEmployee={historyScope !== 'my'}
          emptyTitle="No leave history found"
          emptyDescription="Try adjusting your filters or date range."
        />
        {(historyQuery.data?.data?.total ?? 0) > PAGE_SIZE && (
          <div className="mt-4">
            <CommonPagination
              page={historyPage}
              pageSize={PAGE_SIZE}
              totalItems={historyQuery.data?.data?.total ?? 0}
              onPageChange={setHistoryPage}
            />
          </div>
        )}
      </CommonCard>

      <LeaveApplyModal
        open={isApplyOpen}
        onClose={() => setIsApplyOpen(false)}
        onSubmit={handleApply}
        isLoading={isApplying}
      />

      <LeaveRejectModal
        open={Boolean(rejectLeaveId)}
        onClose={() => setRejectLeaveId(null)}
        onConfirm={handleRejectConfirm}
        isLoading={isRejecting}
        employeeName={rejectTarget?.employee_name}
      />
    </div>
  );
};

export default LeaveManagement;
