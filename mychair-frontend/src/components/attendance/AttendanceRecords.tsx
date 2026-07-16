import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';

import {
  useGetAttendanceSummaryQuery,
  useListAllAttendanceQuery,
  useListBranchAttendanceQuery,
  useListMyAttendanceQuery,
} from '../../redux/slices/attendance/attendanceApi';
import type { EmployeeListItem } from '../../redux/slices/employees/Types';
import { ROLES } from '../../constants';
import { isSuperAdmin, normalizeRole } from '../../config/rbac';
import type { RootState } from '../../redux/store';
import { CommonCard, CommonPagination, FormField, Input } from '../common';
import AttendanceMonthCalendar from './AttendanceMonthCalendar';
import AttendanceSummaryCards from './AttendanceSummaryCards';
import AttendanceTimeline from './AttendanceTimeline';

interface AttendanceRecordsProps {
  selectedEmployee?: EmployeeListItem | null;
  showEmployeeSummary?: boolean;
}

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

  if (showManagedView && !selectedEmployee) {
    return null;
  }

  return (
    <div className="space-y-6">
      {selectedEmployee && (
        <CommonCard className="!shadow-none">
          <div className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="text-sm text-gray-500">Selected Employee</p>
              <h3 className="text-xl font-semibold text-gray-900">{selectedEmployee.full_name}</h3>
              <p className="mt-1 text-sm text-gray-500">
                {selectedEmployee.email}
                {selectedEmployee.phone ? ` • ${selectedEmployee.phone}` : ''}
              </p>
              <p className="mt-1 text-sm text-gray-500">
                {selectedEmployee.role.replace('_', ' ')}
                {selectedEmployee.branch_name ? ` • ${selectedEmployee.branch_name}` : ''}
              </p>
            </div>
          </div>
        </CommonCard>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <FormField label="From" name="date_from">
          <Input
            id="date_from"
            type="date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value);
              setPage(1);
            }}
          />
        </FormField>
        <FormField label="To" name="date_to">
          <Input
            id="date_to"
            type="date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value);
              setPage(1);
            }}
          />
        </FormField>
      </div>

      <AttendanceSummaryCards
        summary={summaryQuery.data?.data}
        loading={summaryQuery.isLoading}
      />

      <CommonCard title="Attendance Calendar" subtitle="Quick monthly overview">
        <div className="space-y-4 p-5">
          <div className="flex flex-wrap gap-3">
            <FormField label="Month" name="calendar_month">
              <Input
                id="calendar_month"
                type="number"
                min={1}
                max={12}
                value={calendarMonth}
                onChange={(event) => setCalendarMonth(Number(event.target.value))}
              />
            </FormField>
            <FormField label="Year" name="calendar_year">
              <Input
                id="calendar_year"
                type="number"
                min={2020}
                max={3000}
                value={calendarYear}
                onChange={(event) => setCalendarYear(Number(event.target.value))}
              />
            </FormField>
          </div>
          <AttendanceMonthCalendar
            records={records?.items ?? []}
            month={calendarMonth}
            year={calendarYear}
          />
        </div>
      </CommonCard>

      <CommonCard title="Attendance History" subtitle="Day-by-day check-in and check-out details">
        <div className="space-y-4 p-5">
          <AttendanceTimeline records={records?.items ?? []} loading={activeQuery.isLoading} />
          {records && records.total > 0 && (
            <CommonPagination
              page={records.page}
              pageSize={records.limit}
              totalItems={records.total}
              onPageChange={setPage}
            />
          )}
        </div>
      </CommonCard>
    </div>
  );
};

export default AttendanceRecords;
