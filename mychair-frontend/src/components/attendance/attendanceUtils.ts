import { AttendanceRecord } from '../../redux/slices/attendance/attendanceApi';

export const formatTime12h = (iso?: string | null): string => {
  if (!iso) return '---';
  const trimmed = iso.trim();
  const timeMatch = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = parseInt(timeMatch[2], 10);
    const meridiem = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    const hourStr = String(hour).padStart(2, '0');
    const minStr = String(minute).padStart(2, '0');
    return `${hourStr}:${minStr} ${meridiem}`;
  }
  const date = new Date(trimmed);
  if (isNaN(date.getTime())) return '---';
  return date.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatShiftDisplay = (
  start?: string | null,
  end?: string | null,
  timing?: string | null
): string => {
  if (timing && timing.trim()) return timing.trim();
  if (start && end) {
    return `${formatTime12h(start)} – ${formatTime12h(end)}`;
  }
  if (start) {
    return `From ${formatTime12h(start)}`;
  }
  return 'Shift not recorded';
};

export const formatMinutesDuration = (minutes?: number | null): string => {
  if (minutes == null || minutes <= 0) return '---';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs === 0) return `${mins}m`;
  if (mins === 0) return `${hrs}h`;
  return `${hrs}h ${mins}m`;
};

export const formatWorkDuration = (minutes?: number, hours?: number): string => {
  if (minutes && minutes > 0) {
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hrs === 0) return `${mins}m`;
    return `${hrs}h ${mins}m`;
  }
  if (hours && hours > 0) {
    const totalMinutes = Math.round(hours * 60);
    const hrs = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    if (hrs === 0) return `${mins}m`;
    return `${hrs}h ${mins}m`;
  }
  return '---';
};

export const statusLabel = (status: string): string => {
  switch (status) {
    case 'PRESENT':
      return 'Present';
    case 'LATE':
      return 'Late';
    case 'HALF_DAY':
      return 'Half Day';
    case 'ABSENT':
      return 'Absent';
    case 'LEAVE':
      return 'Leave';
    case 'WEEK_OFF':
      return 'Week Off';
    default:
      return status ? status.replace('_', ' ') : 'Not Marked';
  }
};

export const statusTone = (status: string): string => {
  switch (status) {
    case 'PRESENT':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-xs';
    case 'LATE':
      return 'bg-amber-50 text-amber-700 border-amber-200/80 shadow-xs';
    case 'HALF_DAY':
      return 'bg-orange-50 text-orange-700 border-orange-200/80 shadow-xs';
    case 'ABSENT':
      return 'bg-rose-50 text-rose-700 border-rose-200/80 shadow-xs';
    case 'LEAVE':
      return 'bg-purple-50 text-purple-700 border-purple-200/80 shadow-xs';
    case 'WEEK_OFF':
      return 'bg-sky-50 text-sky-700 border-sky-200/80 shadow-xs';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200 shadow-xs';
  }
};

export const calendarDayColor = (status?: string): string => {
  switch (status) {
    case 'PRESENT':
      return 'bg-emerald-500';
    case 'LATE':
      return 'bg-amber-500';
    case 'ABSENT':
      return 'bg-rose-500';
    case 'LEAVE':
      return 'bg-purple-500';
    case 'WEEK_OFF':
      return 'bg-sky-500';
    case 'HALF_DAY':
      return 'bg-orange-500';
    default:
      return 'bg-slate-200';
  }
};

export const groupRecordsByDate = (records: AttendanceRecord[]): AttendanceRecord[] =>
  [...records].sort(
    (a, b) => new Date(b.attendance_date).getTime() - new Date(a.attendance_date).getTime()
  );

