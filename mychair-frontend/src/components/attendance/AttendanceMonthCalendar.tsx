import React, { useMemo } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

import type { AttendanceRecord } from '../../redux/slices/attendance/attendanceApi';
import { formatDateDMY } from '../../utils/utilities';
import { calendarDayColor, statusLabel } from './attendanceUtils';

interface AttendanceMonthCalendarProps {
  records: AttendanceRecord[];
  month: number;
  year: number;
}

const legendItems = [
  { label: 'Present', color: 'bg-emerald-500' },
  { label: 'Late', color: 'bg-amber-500' },
  { label: 'Half Day', color: 'bg-orange-500' },
  { label: 'Absent', color: 'bg-rose-500' },
  { label: 'Leave', color: 'bg-purple-500' },
  { label: 'Week Off', color: 'bg-sky-500' },
];

const AttendanceMonthCalendar: React.FC<AttendanceMonthCalendarProps> = ({
  records,
  month,
  year,
}) => {
  const statusByDate = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((record) => map.set(record.attendance_date, record.status));
    return map;
  }, [records]);

  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekday = new Date(year, month - 1, 1).getDay();

  const todayIso = new Date().toISOString().split('T')[0];

  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => {
    const dayNumber = index - firstWeekday + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) return null;
    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    return {
      dayNumber,
      isoDate,
      status: statusByDate.get(isoDate),
      isToday: isoDate === todayIso,
    };
  });

  const monthName = new Date(year, month - 1).toLocaleString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="rounded-3xl border border-[var(--color-border-soft)] bg-white p-5 shadow-soft">
      {/* Calendar Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-soft)] pb-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--color-surface-muted)] text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)]">
            <CalendarIcon className="h-4.5 w-4.5" />
          </div>
          <h3 className="text-base font-bold text-[var(--color-text-primary)]">{monthName}</h3>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 text-xs">
          {legendItems.map((item) => (
            <span
              key={item.label}
              className="flex items-center gap-1.5 rounded-lg bg-[var(--color-surface-muted)] px-2.5 py-0.5 font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border-soft)]"
            >
              <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
              {item.label}
            </span>
          ))}
        </div>
      </div>

      {/* Days of Week Header */}
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-bold uppercase tracking-wider text-[var(--color-text-tertiary)]">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid Cells */}
      <div className="mt-2 grid grid-cols-7 gap-2">
        {cells.map((cell, index) =>
          cell ? (
            <div
              key={cell.isoDate}
              title={
                cell.status
                  ? `${formatDateDMY(cell.isoDate)} — ${statusLabel(cell.status)}`
                  : formatDateDMY(cell.isoDate)
              }
              className={`group relative flex flex-col items-center justify-between rounded-2xl border p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft min-h-[64px] ${
                cell.isToday
                  ? 'border-[var(--color-brand-gold)] bg-[var(--color-surface-muted)] ring-2 ring-[var(--color-brand-gold)]/30'
                  : cell.status
                    ? 'border-[var(--color-border-soft)] bg-white hover:border-[var(--color-border-strong)]'
                    : 'border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] text-gray-400'
              }`}
            >
              <span
                className={`text-xs font-bold ${
                  cell.isToday ? 'text-[var(--color-brand-gold-dark)]' : 'text-[var(--color-text-primary)]'
                }`}
              >
                {cell.dayNumber}
              </span>

              {cell.status ? (
                <div className="mt-1 flex flex-col items-center gap-1">
                  <span
                    className={`h-2.5 w-2.5 rounded-full shadow-xs ${calendarDayColor(
                      cell.status
                    )}`}
                  />
                  <span className="hidden sm:inline text-[9px] font-semibold text-[var(--color-text-secondary)] truncate max-w-[48px]">
                    {statusLabel(cell.status)}
                  </span>
                </div>
              ) : (
                <span className="h-2.5 w-2.5 rounded-full bg-gray-100" />
              )}
            </div>
          ) : (
            <div key={`empty-${index}`} className="min-h-[64px]" />
          )
        )}
      </div>
    </div>
  );
};

export default AttendanceMonthCalendar;
