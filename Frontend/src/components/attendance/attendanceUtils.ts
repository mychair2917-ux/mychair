import { AttendanceRecord } from '../../redux/slices/attendance/attendanceApi';

export const formatTime12h = (iso?: string | null): string => {
  if (!iso) return '---';
  const date = new Date(iso);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
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
    case 'WEEK_OFF':
      return 'Week Off';
    default:
      return status;
  }
};

export const statusTone = (status: string): string => {
  switch (status) {
    case 'PRESENT':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'LATE':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'HALF_DAY':
      return 'bg-orange-50 text-orange-700 border-orange-200';
    case 'ABSENT':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'WEEK_OFF':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    default:
      return 'bg-slate-50 text-slate-600 border-slate-200';
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
