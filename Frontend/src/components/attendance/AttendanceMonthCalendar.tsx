import React, { useMemo } from 'react';

import { AttendanceRecord } from '../../redux/slices/attendance/attendanceApi';
import { formatDateDMY } from '../../utils/utilities';
import { calendarDayColor, statusLabel } from './attendanceUtils';

interface AttendanceMonthCalendarProps {
  records: AttendanceRecord[];
  month: number;
  year: number;
}

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
  const cells = Array.from({ length: firstWeekday + daysInMonth }, (_, index) => {
    const dayNumber = index - firstWeekday + 1;
    if (dayNumber < 1 || dayNumber > daysInMonth) return null;
    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`;
    return { dayNumber, isoDate, status: statusByDate.get(isoDate) };
  });

  return (
    <div className="rounded-3xl border border-[var(--color-border-soft)] bg-white p-3 sm:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-gray-900">
          {new Date(year, month - 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' })}
        </h3>
        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-emerald-500" /> Present</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-amber-500" /> Late</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-rose-500" /> Absent</span>
          <span className="flex items-center gap-1"><span className="h-3 w-3 rounded-full bg-sky-500" /> Week Off</span>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-gray-500 sm:gap-2 sm:text-xs">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day}>{day}</div>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-7 gap-0.5 sm:gap-2">
        {cells.map((cell, index) =>
          cell ? (
            <div
              key={cell.isoDate}
              title={cell.status ? `${formatDateDMY(cell.isoDate)} — ${statusLabel(cell.status)}` : formatDateDMY(cell.isoDate)}
              className="flex flex-col items-center gap-1 rounded-lg border border-[var(--color-border-soft)] px-0.5 py-1.5 sm:rounded-xl sm:px-1 sm:py-2"
            >
              <span className="text-sm font-medium text-gray-800">{cell.dayNumber}</span>
              <span className={`h-2.5 w-2.5 rounded-full ${calendarDayColor(cell.status)}`} />
            </div>
          ) : (
            <div key={`empty-${index}`} />
          )
        )}
      </div>
    </div>
  );
};

export default AttendanceMonthCalendar;
