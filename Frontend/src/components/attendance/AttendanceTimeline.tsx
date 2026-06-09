import React from 'react';
import { Clock3, LogIn, LogOut } from 'lucide-react';

import { AttendanceRecord } from '../../redux/slices/attendance/attendanceApi';
import { formatDateDMY } from '../../utils/utilities';
import { cn } from '../../utils/cn';
import { EmptyState } from '../common';
import {
  formatTime12h,
  formatWorkDuration,
  groupRecordsByDate,
  statusLabel,
  statusTone,
} from './attendanceUtils';

interface AttendanceTimelineProps {
  records: AttendanceRecord[];
  loading?: boolean;
}

const AttendanceTimeline: React.FC<AttendanceTimelineProps> = ({ records, loading }) => {
  if (loading) {
    return <div className="h-48 animate-pulse rounded-3xl bg-[var(--color-surface-muted)]" />;
  }

  const sorted = groupRecordsByDate(records);
  if (!sorted.length) {
    return (
      <EmptyState
        title="No attendance records yet"
        description="Records will appear here after check-ins."
      />
    );
  }

  return (
    <div className="space-y-4">
      {sorted.map((record) => (
        <div
          key={record.id}
          className="rounded-3xl border border-[var(--color-border-soft)] bg-white p-5 shadow-soft"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-lg font-semibold text-gray-900">
                📅 {formatDateDMY(record.attendance_date)}
              </p>
              <span
                className={cn(
                  'mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-medium',
                  statusTone(record.status)
                )}
              >
                {statusLabel(record.status)}
              </span>
            </div>
            <div className="text-right text-sm text-gray-500">
              <p className="font-medium text-gray-700">
                ⏱ {formatWorkDuration(record.total_work_minutes, record.total_hours)}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--color-surface-muted)] px-4 py-3">
              <LogIn className="h-4 w-4 text-emerald-600" />
              <div>
                <p className="text-xs text-gray-500">Check-In</p>
                <p className="font-semibold text-gray-900">{formatTime12h(record.check_in_time)}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl bg-[var(--color-surface-muted)] px-4 py-3">
              <LogOut className="h-4 w-4 text-rose-600" />
              <div>
                <p className="text-xs text-gray-500">Check-Out</p>
                <p className="font-semibold text-gray-900">{formatTime12h(record.check_out_time)}</p>
              </div>
            </div>
          </div>

          {record.late_minutes > 0 && (
            <p className="mt-3 flex items-center gap-2 text-sm text-amber-700">
              <Clock3 className="h-4 w-4" />
              Late by {record.late_minutes} minutes
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

export default AttendanceTimeline;
