import React, { useState } from 'react';
import { CheckCircle2, Clock3, LogIn, LogOut, MapPin } from 'lucide-react';

import {
  useCheckInMutation,
  useCheckOutMutation,
  useGetTodayAttendanceStatusQuery,
} from '../../redux/slices/attendance/attendanceApi';
import { formatDateDMY } from '../../utils/utilities';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { getCurrentPosition } from '../../utils/geolocation';
import { cn } from '../../utils/cn';
import { Button, CommonCard, showToast } from '../common';

const formatTimeHM = (iso?: string | null): string => {
  if (!iso) return '---';
  const date = new Date(iso);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const statusClassName = (status?: string | null): string => {
  switch (status) {
    case 'PRESENT':
      return 'bg-emerald-50 text-emerald-700';
    case 'LATE':
      return 'bg-amber-50 text-amber-700';
    case 'HALF_DAY':
      return 'bg-orange-50 text-orange-700';
    case 'ABSENT':
      return 'bg-rose-50 text-rose-700';
    case 'WEEK_OFF':
      return 'bg-sky-50 text-sky-700';
    default:
      return 'bg-slate-100 text-slate-600';
  }
};

const MarkAttendanceCard: React.FC = () => {
  const { data, isLoading, refetch } = useGetTodayAttendanceStatusQuery();
  const [checkIn, { isLoading: isCheckingIn }] = useCheckInMutation();
  const [checkOut, { isLoading: isCheckingOut }] = useCheckOutMutation();
  const [actionError, setActionError] = useState<string | null>(null);

  const status = data?.data;

  const handleAttendanceAction = async (action: 'check-in' | 'check-out') => {
    setActionError(null);
    try {
      let coords = { latitude: 0, longitude: 0 };
      if (status?.location_required) {
        coords = await getCurrentPosition();
      }
      if (action === 'check-in') {
        await checkIn(coords).unwrap();
        showToast('success', 'Checked in successfully');
      } else {
        await checkOut(coords).unwrap();
        showToast('success', 'Checked out successfully');
      }
      refetch();
    } catch (error) {
      const message = getApiErrorMessage(error, 'Unable to mark attendance');
      setActionError(message);
      showToast('error', message);
    }
  };

  if (isLoading) {
    return (
      <CommonCard title="Mark Attendance" loading>
        <div className="h-40" />
      </CommonCard>
    );
  }

  return (
    <CommonCard
      title="Mark Attendance"
      subtitle="One tap to check in or check out for today"
      className="max-w-2xl"
    >
      <div className="space-y-6 p-5">
        <div className="grid gap-4 rounded-2xl bg-[var(--color-surface-muted)] p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Today</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">
              {formatDateDMY(status?.attendance_date)}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Shift</p>
            <p className="mt-1 flex items-center gap-2 text-lg font-semibold text-gray-900">
              <Clock3 className="h-4 w-4 text-[var(--color-brand-gold)]" />
              {status?.shift_timing || '---'}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-gray-500">Status</p>
            <span
              className={cn(
                'mt-1 inline-flex rounded-full px-3 py-1 text-sm font-medium',
                statusClassName(status?.status)
              )}
            >
              {status?.status === 'WEEK_OFF'
                ? 'Week Off'
                : status?.status
                  ? status.status.replace('_', ' ')
                  : 'Not Marked'}
            </span>
          </div>
        </div>

        {status?.status === 'WEEK_OFF' && (
          <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            Today is your scheduled week off. Attendance is not required.
          </div>
        )}

        {status?.location_required && !status.branch_configured && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Salon location is not configured yet. Ask your salon owner to set it in Settings.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Button
            size="lg"
            fullWidth
            leftIcon={status?.is_checked_in ? <CheckCircle2 className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            isLoading={isCheckingIn}
            disabled={!status?.can_check_in || isCheckingIn || isCheckingOut}
            onClick={() => handleAttendanceAction('check-in')}
          >
            {status?.is_checked_in ? 'Checked In ✓' : 'Check In'}
          </Button>

          <Button
            size="lg"
            fullWidth
            variant={status?.can_check_out ? 'primary' : 'secondary'}
            leftIcon={status?.is_checked_out ? <CheckCircle2 className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
            isLoading={isCheckingOut}
            disabled={!status?.can_check_out || isCheckingIn || isCheckingOut}
            onClick={() => handleAttendanceAction('check-out')}
          >
            {status?.is_checked_out ? 'Checked Out ✓' : 'Check Out'}
          </Button>
        </div>

        {actionError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {actionError}
          </div>
        )}

        <div className="grid gap-4 rounded-2xl border border-[var(--color-border-soft)] p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs text-gray-500">Check-In</p>
            <p className="mt-1 font-semibold text-gray-900">{formatTimeHM(status?.check_in_time)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Check-Out</p>
            <p className="mt-1 font-semibold text-gray-900">{formatTimeHM(status?.check_out_time)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Hours</p>
            <p className="mt-1 font-semibold text-gray-900">
              {status?.total_hours ? `${status.total_hours.toFixed(2)} hrs` : '---'}
            </p>
          </div>
        </div>

        {status?.location_required && (
          <p className="flex items-center gap-2 text-sm text-gray-500">
            <MapPin className="h-4 w-4" />
            Location validation is required for your role.
          </p>
        )}
      </div>
    </CommonCard>
  );
};

export default MarkAttendanceCard;
