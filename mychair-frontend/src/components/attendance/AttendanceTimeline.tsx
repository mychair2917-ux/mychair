import React from 'react';
import { Calendar, Clock3, LogIn, LogOut, Timer, AlertTriangle, CalendarOff } from 'lucide-react';

import type { AttendanceRecord } from '../../redux/slices/attendance/attendanceApi';
import { formatDateDMY } from '../../utils/utilities';
import { cn } from '../../utils/cn';
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
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, idx) => (
          <div
            key={idx}
            className="h-44 animate-pulse rounded-3xl border border-[var(--color-border-soft)] bg-white p-5"
          />
        ))}
      </div>
    );
  }

  const sorted = groupRecordsByDate(records);

  if (!sorted.length) {
    return (
      <div className="rounded-3xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-muted)] py-12 px-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)]">
          <CalendarOff className="h-7 w-7" />
        </div>
        <h3 className="mt-4 text-base font-bold text-[var(--color-text-primary)]">No attendance records found</h3>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)] max-w-sm mx-auto">
          No check-in or check-out logs recorded for the selected period.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {sorted.map((record) => {
        const hasLate = record.late_minutes > 0;
        const workDuration = formatWorkDuration(record.total_work_minutes, record.total_hours);

        return (
          <div
            key={record.id}
            className="group relative overflow-hidden rounded-3xl border border-[var(--color-border-soft)] bg-white p-5 shadow-soft transition-all duration-200 hover:shadow-card"
          >
            {/* Top Date & Duration Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-soft)] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)]">
                  <Calendar className="h-4.5 w-4.5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-[var(--color-text-primary)]">
                    {formatDateDMY(record.attendance_date)}
                  </h4>
                  {record.employee_name && (
                    <p className="text-xs text-[var(--color-text-secondary)]">{record.employee_name}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold border',
                    statusTone(record.status)
                  )}
                >
                  {statusLabel(record.status)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-bold text-[var(--color-text-primary)] border border-[var(--color-border-soft)]">
                  <Timer className="h-3.5 w-3.5 text-[var(--color-brand-gold-dark)]" />
                  {workDuration}
                </span>
              </div>
            </div>

            {/* Step Timeline */}
            <div className="mt-5 relative pl-4 sm:pl-6 space-y-4 before:absolute before:left-2 sm:before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--color-border-soft)]">
              {/* Step 1: Check In */}
              <div className="relative flex items-center gap-3">
                <div className="absolute -left-4 sm:-left-6 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs ring-4 ring-white">
                  <LogIn className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-1 items-center justify-between rounded-2xl bg-emerald-50/60 border border-emerald-100 px-3.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-emerald-900">Check In</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-800">
                    {formatTime12h(record.check_in_time)}
                  </span>
                </div>
              </div>

              {/* Step 2: Late warning if applicable */}
              {hasLate && (
                <div className="relative flex items-center gap-3">
                  <div className="absolute -left-4 sm:-left-6 flex h-6 w-6 items-center justify-center rounded-full bg-amber-500 text-white shadow-xs ring-4 ring-white">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </div>
                  <div className="flex flex-1 items-center justify-between rounded-2xl bg-amber-50/80 border border-amber-200/80 px-3.5 py-2">
                    <div className="flex items-center gap-2">
                      <Clock3 className="h-3.5 w-3.5 text-amber-700" />
                      <span className="text-xs font-semibold text-amber-900">Late Arrival</span>
                    </div>
                    <span className="text-xs font-bold text-amber-800">
                      Late by {record.late_minutes} mins
                    </span>
                  </div>
                </div>
              )}

              {/* Step 3: Check Out */}
              <div className="relative flex items-center gap-3">
                <div className="absolute -left-4 sm:-left-6 flex h-6 w-6 items-center justify-center rounded-full bg-rose-500 text-white shadow-xs ring-4 ring-white">
                  <LogOut className="h-3.5 w-3.5" />
                </div>
                <div className="flex flex-1 items-center justify-between rounded-2xl bg-rose-50/60 border border-rose-100 px-3.5 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    <span className="text-xs font-bold text-rose-900">Check Out</span>
                  </div>
                  <span className="text-xs font-bold text-rose-800">
                    {formatTime12h(record.check_out_time)}
                  </span>
                </div>
              </div>
            </div>

            {/* Notes if present */}
            {record.notes && (
              <div className="mt-4 rounded-2xl bg-[var(--color-surface-muted)] p-3 text-xs text-[var(--color-text-secondary)] border border-[var(--color-border-soft)]">
                <span className="font-semibold text-[var(--color-text-primary)]">Note:</span> {record.notes}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AttendanceTimeline;
