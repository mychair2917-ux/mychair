import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  Edit3,
  LogIn,
  LogOut,
  RotateCcw,
  Table as TableIcon,
  Timer,
  AlertCircle,
} from 'lucide-react';
import { useSelector } from 'react-redux';

import {
  type AttendanceRecord,
  useGetAttendanceSummaryQuery,
  useListAllAttendanceQuery,
  useListBranchAttendanceQuery,
  useListMyAttendanceQuery,
} from '../../redux/slices/attendance/attendanceApi';
import type { EmployeeListItem } from '../../redux/slices/employees/Types';
import { ROLES } from '../../constants';
import { isSuperAdmin, normalizeRole } from '../../config/rbac';
import type { RootState } from '../../redux/store';
import { cn } from '../../utils/cn';
import { formatDateDMY } from '../../utils/utilities';
import { CommonCard, CommonPagination, FormField, Input } from '../common';
import AttendanceMonthCalendar from './AttendanceMonthCalendar';
import AttendanceSummaryCards from './AttendanceSummaryCards';
import AttendanceTimeline from './AttendanceTimeline';
import AttendanceModal from './AttendanceModal';
import { formatTime12h, formatWorkDuration, statusLabel, statusTone } from './attendanceUtils';

interface AttendanceRecordsProps {
  selectedEmployee?: EmployeeListItem | null;
  showEmployeeSummary?: boolean;
}

type ViewTab = 'table' | 'timeline' | 'calendar';

const AttendanceRecords: React.FC<AttendanceRecordsProps> = ({
  selectedEmployee,
  showEmployeeSummary = false,
}) => {
  const role = useSelector((state: RootState) => state.auth.user?.role);
  const selectedSalonId = useSelector((state: RootState) => state.auth.selectedSalonId);
  const normalizedRole = normalizeRole(role);

  const [page, setPage] = useState(1);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState<ViewTab>('table');
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [isCreatingRecord, setIsCreatingRecord] = useState(false);

  const now = new Date();
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());

  const employeeId = selectedEmployee?.id;

  const calendarRange = useMemo(() => {
    const lastDay = new Date(calendarYear, calendarMonth, 0).getDate();
    return {
      from: `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-01`,
      to: `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
    };
  }, [calendarMonth, calendarYear]);

  const queryParams = useMemo(
    () => ({
      page,
      limit: 31,
      date_from: dateFrom || calendarRange.from,
      date_to: dateTo || calendarRange.to,
      employee_id: employeeId,
      salon_id: isSuperAdmin(role) ? selectedSalonId || undefined : undefined,
    }),
    [page, dateFrom, dateTo, calendarRange, employeeId, role, selectedSalonId]
  );

  const showManagedView =
    showEmployeeSummary &&
    (isSuperAdmin(role) ||
      normalizedRole === ROLES.SALON_OWNER ||
      normalizedRole === ROLES.SALON_ADMIN);

  const showMyOnly = normalizedRole === ROLES.EMPLOYEE && !employeeId;
  const showAll = isSuperAdmin(role) && employeeId;
  const showBranch =
    (normalizedRole === ROLES.SALON_OWNER ||
      normalizedRole === ROLES.SALON_ADMIN ||
      normalizedRole === ROLES.SALON_MANAGER) &&
    (employeeId || !showManagedView);

  const skipRecords = showManagedView && !employeeId;

  const myQuery = useListMyAttendanceQuery(queryParams, { skip: !showMyOnly || skipRecords });
  const branchQuery = useListBranchAttendanceQuery(queryParams, {
    skip: !showBranch || skipRecords,
  });
  const allQuery = useListAllAttendanceQuery(queryParams, { skip: !showAll || skipRecords });

  const activeQuery = showMyOnly ? myQuery : showAll ? allQuery : branchQuery;
  const records = activeQuery.data?.data;

  const summaryQuery = useGetAttendanceSummaryQuery(queryParams, {
    skip: skipRecords,
  });

  const canEditRecord =
    isSuperAdmin(role) ||
    normalizedRole === ROLES.SALON_OWNER ||
    normalizedRole === ROLES.SALON_ADMIN;

  const handleResetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setPage(1);
  };

  const handlePresetDate = (type: 'today' | 'this_month' | 'last_30') => {
    const todayStr = now.toISOString().split('T')[0];
    if (type === 'today') {
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (type === 'this_month') {
      const firstDay = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      setDateFrom(firstDay);
      setDateTo(todayStr);
    } else if (type === 'last_30') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      setDateFrom(past.toISOString().split('T')[0]);
      setDateTo(todayStr);
    }
    setPage(1);
  };

  if (showManagedView && !selectedEmployee) {
    return null;
  }

  const itemsList = records?.items ?? [];

  return (
    <div className="space-y-6">
      {/* Selected Employee Banner */}
      {selectedEmployee && (
        <CommonCard className="!shadow-soft border-[var(--color-brand-gold)]/40 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-4 p-1 sm:p-2">
            <div className="flex items-center gap-4">
              <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-brand-gold)] text-white font-bold text-lg shadow-xs">
                {selectedEmployee.full_name.substring(0, 2).toUpperCase()}
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-brand-gold-dark)]">
                  Selected Staff Record
                </span>
                <h3 className="text-xl font-bold text-[var(--color-text-primary)]">{selectedEmployee.full_name}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  <span>{selectedEmployee.email}</span>
                  {selectedEmployee.phone && <span>• {selectedEmployee.phone}</span>}
                  <span className="rounded-md bg-[var(--color-surface-muted)] px-2 py-0.5 font-semibold text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)]">
                    {selectedEmployee.role.replace('_', ' ')}
                  </span>
                  {selectedEmployee.branch_name && (
                    <span className="rounded-md bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
                      {selectedEmployee.branch_name}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {canEditRecord && (
              <button
                type="button"
                onClick={() => setIsCreatingRecord(true)}
                className="flex items-center gap-2 rounded-2xl bg-[var(--color-brand-gold)] px-4 py-2.5 text-xs font-bold text-white shadow-soft transition-all duration-200 hover:-translate-y-0.5"
              >
                <Edit3 className="h-4 w-4" />
                Mark Attendance Record
              </button>
            )}
          </div>
        </CommonCard>
      )}

      {/* Date Filter & View Switcher Card */}
      <CommonCard
        title="Attendance Range & Filters"
        subtitle="Filter attendance records by custom dates or standard presets"
        className="!shadow-soft"
        actions={
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => handlePresetDate('today')}
              className="rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] px-3 py-1.5 font-semibold text-[var(--color-text-primary)] hover:bg-white transition-colors"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePresetDate('this_month')}
              className="rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] px-3 py-1.5 font-semibold text-[var(--color-text-primary)] hover:bg-white transition-colors"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handlePresetDate('last_30')}
              className="rounded-xl border border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] px-3 py-1.5 font-semibold text-[var(--color-text-primary)] hover:bg-white transition-colors"
            >
              Last 30 Days
            </button>
            {(dateFrom || dateTo) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            )}
          </div>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2 p-1 sm:p-2">
          <FormField label="Date From" name="date_from">
            <div className="relative">
              <CalendarIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="date_from"
                type="date"
                value={dateFrom}
                onChange={(event) => {
                  setDateFrom(event.target.value);
                  setPage(1);
                }}
                className="pl-9.5 rounded-2xl border-[var(--color-border-soft)] bg-white"
              />
            </div>
          </FormField>
          <FormField label="Date To" name="date_to">
            <div className="relative">
              <CalendarIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="date_to"
                type="date"
                value={dateTo}
                onChange={(event) => {
                  setDateTo(event.target.value);
                  setPage(1);
                }}
                className="pl-9.5 rounded-2xl border-[var(--color-border-soft)] bg-white"
              />
            </div>
          </FormField>
        </div>
      </CommonCard>

      {/* Summary KPI Cards */}
      <AttendanceSummaryCards
        summary={summaryQuery.data?.data}
        loading={summaryQuery.isLoading}
      />

      {/* View Switcher Tabs & Main Content */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-soft)] pb-3">
          <div className="flex items-center gap-1 rounded-2xl bg-[var(--color-surface-muted)] p-1 border border-[var(--color-border-soft)]">
            <button
              type="button"
              onClick={() => setActiveTab('table')}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-200',
                activeTab === 'table'
                  ? 'bg-white text-[var(--color-text-primary)] shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              )}
            >
              <TableIcon className="h-3.5 w-3.5 text-[var(--color-brand-gold)]" />
              Table View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('timeline')}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-200',
                activeTab === 'timeline'
                  ? 'bg-white text-[var(--color-text-primary)] shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              )}
            >
              <Clock className="h-3.5 w-3.5 text-[var(--color-brand-gold)]" />
              Timeline View
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('calendar')}
              className={cn(
                'flex items-center gap-2 rounded-xl px-3.5 py-1.5 text-xs font-bold transition-all duration-200',
                activeTab === 'calendar'
                  ? 'bg-white text-[var(--color-text-primary)] shadow-xs'
                  : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              )}
            >
              <CalendarDays className="h-3.5 w-3.5 text-[var(--color-brand-gold)]" />
              Calendar View
            </button>
          </div>

          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
            Total Records: <strong className="text-[var(--color-text-primary)]">{records?.total ?? 0}</strong>
          </span>
        </div>

        {/* Tab 1: Attendance Table View */}
        {activeTab === 'table' && (
          <CommonCard className="!p-0 overflow-hidden !shadow-soft">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 z-10 bg-[var(--color-surface-muted)] border-b border-[var(--color-border-soft)] text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Date</th>
                    <th className="py-3.5 px-4">Staff Member</th>
                    <th className="py-3.5 px-4">Attendance Status</th>
                    <th className="py-3.5 px-4">Check In</th>
                    <th className="py-3.5 px-4">Check Out</th>
                    <th className="py-3.5 px-4">Work Duration</th>
                    <th className="py-3.5 px-4">Late Delay</th>
                    {canEditRecord && <th className="py-3.5 px-4 text-right">Action</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border-soft)] text-[var(--color-text-primary)] font-medium">
                  {activeQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <tr key={idx} className="animate-pulse">
                        <td colSpan={canEditRecord ? 8 : 7} className="p-4">
                          <div className="h-6 rounded-lg bg-[var(--color-surface-muted)]" />
                        </td>
                      </tr>
                    ))
                  ) : !itemsList.length ? (
                    <tr>
                      <td colSpan={canEditRecord ? 8 : 7} className="py-12 px-4 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-surface-muted)] text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)]">
                          <AlertCircle className="h-6 w-6" />
                        </div>
                        <h4 className="mt-3 text-sm font-bold text-[var(--color-text-primary)]">
                          No attendance records found
                        </h4>
                        <p className="mt-1 text-xs text-[var(--color-text-secondary)] max-w-sm mx-auto">
                          Try expanding your date range filters or select another staff member.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    itemsList.map((record) => {
                      const workHours = formatWorkDuration(
                        record.total_work_minutes,
                        record.total_hours
                      );
                      return (
                        <tr
                          key={record.id}
                          className="transition-colors duration-150 hover:bg-[var(--color-surface-bg)]"
                        >
                          <td className="py-3.5 px-4 font-bold text-[var(--color-text-primary)] whitespace-nowrap">
                            {formatDateDMY(record.attendance_date)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-muted)] text-[var(--color-brand-gold-dark)] text-[11px] font-bold border border-[var(--color-border-soft)]">
                                {record.employee_name
                                  ? record.employee_name.substring(0, 2).toUpperCase()
                                  : 'ST'}
                              </div>
                              <div>
                                <p className="font-bold text-[var(--color-text-primary)]">{record.employee_name || 'Staff'}</p>
                                {record.branch_name && (
                                  <p className="text-[10px] text-[var(--color-text-tertiary)]">{record.branch_name}</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={cn(
                                'inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold border',
                                statusTone(record.status)
                              )}
                            >
                              {statusLabel(record.status)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                              <LogIn className="h-3.5 w-3.5 text-emerald-500" />
                              {formatTime12h(record.check_in_time)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-semibold text-rose-700">
                              <LogOut className="h-3.5 w-3.5 text-rose-500" />
                              {formatTime12h(record.check_out_time)}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 font-semibold text-[var(--color-text-primary)]">
                              <Timer className="h-3.5 w-3.5 text-gray-400" />
                              {workHours}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            {record.late_minutes > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                                {record.late_minutes}m late
                              </span>
                            ) : (
                              <span className="text-[var(--color-text-tertiary)]">On time</span>
                            )}
                          </td>
                          {canEditRecord && (
                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => setEditingRecord(record)}
                                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--color-border-strong)] bg-white px-2.5 py-1 text-[11px] font-semibold text-[var(--color-text-primary)] hover:border-[var(--color-brand-gold)] hover:bg-[var(--color-surface-muted)] transition-all shadow-2xs"
                              >
                                <Edit3 className="h-3 w-3 text-[var(--color-brand-gold-dark)]" />
                                Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {records && records.total > 0 && (
              <div className="border-t border-[var(--color-border-soft)] p-4">
                <CommonPagination
                  page={records.page}
                  pageSize={records.limit}
                  totalItems={records.total}
                  onPageChange={setPage}
                />
              </div>
            )}
          </CommonCard>
        )}

        {/* Tab 2: Timeline View */}
        {activeTab === 'timeline' && (
          <CommonCard title="Attendance Timeline Log" subtitle="Visual daily punch flow" className="!shadow-soft">
            <div className="p-1 sm:p-2">
              <AttendanceTimeline records={itemsList} loading={activeQuery.isLoading} />
              {records && records.total > 0 && (
                <div className="mt-4 pt-4 border-t border-[var(--color-border-soft)]">
                  <CommonPagination
                    page={records.page}
                    pageSize={records.limit}
                    totalItems={records.total}
                    onPageChange={setPage}
                  />
                </div>
              )}
            </div>
          </CommonCard>
        )}

        {/* Tab 3: Calendar View */}
        {activeTab === 'calendar' && (
          <CommonCard title="Attendance Calendar Matrix" subtitle="Monthly grid attendance breakdown" className="!shadow-soft">
            <div className="space-y-4 p-1 sm:p-2">
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] p-3.5">
                <FormField label="Select Month" name="calendar_month">
                  <Input
                    id="calendar_month"
                    type="number"
                    min={1}
                    max={12}
                    value={calendarMonth}
                    onChange={(event) => setCalendarMonth(Number(event.target.value))}
                    className="rounded-xl border-[var(--color-border-soft)] bg-white max-w-[120px]"
                  />
                </FormField>
                <FormField label="Select Year" name="calendar_year">
                  <Input
                    id="calendar_year"
                    type="number"
                    min={2020}
                    max={3000}
                    value={calendarYear}
                    onChange={(event) => setCalendarYear(Number(event.target.value))}
                    className="rounded-xl border-[var(--color-border-soft)] bg-white max-w-[120px]"
                  />
                </FormField>
              </div>
              <AttendanceMonthCalendar
                records={itemsList}
                month={calendarMonth}
                year={calendarYear}
              />
            </div>
          </CommonCard>
        )}
      </div>

      {/* Manual Update Modal */}
      <AttendanceModal
        isOpen={Boolean(editingRecord) || isCreatingRecord}
        onClose={() => {
          setEditingRecord(null);
          setIsCreatingRecord(false);
        }}
        record={editingRecord}
        employee={selectedEmployee}
        onSuccess={() => {
          activeQuery.refetch();
          summaryQuery.refetch();
        }}
      />
    </div>
  );
};

export default AttendanceRecords;
