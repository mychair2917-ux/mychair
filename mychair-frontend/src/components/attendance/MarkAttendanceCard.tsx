import React, { useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock3,
  LogIn,
  LogOut,
  MapPin,
  ShieldCheck,
} from 'lucide-react';

import { useSelector } from 'react-redux';
import { ROLES } from '../../constants';
import { isSuperAdmin, normalizeRole } from '../../config/rbac';
import type { EmployeeListItem } from '../../redux/slices/employees/Types';
import type { RootState } from '../../redux/store';
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
import { statusTone } from './attendanceUtils';

interface MarkAttendanceCardProps {
  employee?: EmployeeListItem | null;
}

const formatTimeHM = (iso?: string | null): string => {
  if (!iso) return '---';
  const date = new Date(iso);
  return date.toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
};

const MarkAttendanceCard: React.FC<MarkAttendanceCardProps> = ({ employee }) => {
  const role = useSelector((state: RootState) => state.auth.user?.role);
  const normalizedRole = normalizeRole(role);
  const canSkipLocation = isSuperAdmin(role) || normalizedRole === ROLES.SALON_OWNER;

  const { data, isLoading, refetch } = useGetTodayAttendanceStatusQuery(
    employee?.id ? { employee_id: employee.id } : undefined
  );
  const [checkIn, { isLoading: isCheckingIn }] = useCheckInMutation();
  const [checkOut, { isLoading: isCheckingOut }] = useCheckOutMutation();
  const [actionError, setActionError] = useState<string | null>(null);

  const status = data?.data;

  const handleAttendanceAction = async (action: 'check-in' | 'check-out') => {
    setActionError(null);
    try {
      let coords: { latitude?: number; longitude?: number; employee_id?: string } = {
        employee_id: employee?.id,
      };

      if (!canSkipLocation && status?.location_required) {
        const geoCoords = await getCurrentPosition();
        coords = { ...coords, ...geoCoords };
      } else {
        coords = { ...coords, latitude: 0, longitude: 0 };
      }

      if (action === 'check-in') {
        await checkIn(coords).unwrap();
        showToast('success', `Checked in successfully${employee ? ` for ${employee.full_name}` : ''}`);
      } else {
        await checkOut(coords).unwrap();
        showToast('success', `Checked out successfully${employee ? ` for ${employee.full_name}` : ''}`);
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
      <CommonCard title="Daily Attendance Punch" loading className="w-full">
        <div className="h-44" />
      </CommonCard>
    );
  }

  const currentStatusLabel =
    status?.status === 'WEEK_OFF'
      ? 'Week Off'
      : status?.status
        ? status.status.replace('_', ' ')
        : 'Not Marked';

  return (
    <CommonCard
      title={employee ? `Mark Attendance - ${employee.full_name}` : 'Daily Attendance Punch'}
      subtitle={
        employee
          ? `One-tap check-in and check-out tracking for ${employee.full_name}`
          : 'One-tap check-in and check-out tracking for today'
      }
      className="w-full !shadow-soft"
    >
      <div className="space-y-6 p-1 sm:p-2">
        {/* Status Info Banner matching app theme */}
        <div className="grid gap-4 rounded-3xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] p-5 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)] shadow-xs">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Date</p>
              <p className="mt-0.5 text-base font-bold text-[var(--color-text-primary)]">
                {formatDateDMY(status?.attendance_date)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)] shadow-xs">
              <Clock3 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Shift</p>
              <p className="mt-0.5 text-base font-bold text-[var(--color-text-primary)]">
                {status?.shift_timing || '09:00 - 18:00'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)] shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Today's Status</p>
              <span
                className={cn(
                  'mt-1 inline-flex items-center rounded-full px-3 py-0.5 text-xs font-semibold border',
                  statusTone(status?.status || '')
                )}
              >
                {currentStatusLabel}
              </span>
            </div>
          </div>
        </div>

        {/* Warnings */}
        {status?.status === 'WEEK_OFF' && (
          <div className="flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-sky-600" />
            <span>Today is your scheduled week off. Attendance punch is not required.</span>
          </div>
        )}

        {status?.location_required && !status.branch_configured && (
          <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <AlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
            <span>Salon location is not configured yet. Ask your salon owner to set it in Settings.</span>
          </div>
        )}

        {/* Action Buttons using theme Button component */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Button
            size="lg"
            fullWidth
            variant={status?.is_checked_in ? 'secondary' : 'primary'}
            leftIcon={status?.is_checked_in ? <CheckCircle2 className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            isLoading={isCheckingIn}
            disabled={!status?.can_check_in || isCheckingIn || isCheckingOut}
            onClick={() => handleAttendanceAction('check-in')}
            className="h-12 rounded-2xl font-bold shadow-soft transition-all duration-200 hover:-translate-y-0.5"
          >
            {status?.is_checked_in ? 'Checked In ✓' : 'Check In Now'}
          </Button>

          <Button
            size="lg"
            fullWidth
            variant={status?.is_checked_out ? 'secondary' : status?.can_check_out ? 'danger' : 'secondary'}
            leftIcon={status?.is_checked_out ? <CheckCircle2 className="h-5 w-5" /> : <LogOut className="h-5 w-5" />}
            isLoading={isCheckingOut}
            disabled={!status?.can_check_out || isCheckingIn || isCheckingOut}
            onClick={() => handleAttendanceAction('check-out')}
            className="h-12 rounded-2xl font-bold shadow-soft transition-all duration-200 hover:-translate-y-0.5"
          >
            {status?.is_checked_out ? 'Checked Out ✓' : 'Check Out Now'}
          </Button>
        </div>

        {actionError && (
          <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Punch Time Details */}
        <div className="grid gap-4 rounded-3xl border border-[var(--color-border-soft)] bg-white p-5 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <LogIn className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Check-In Time</p>
              <p className="mt-0.5 font-bold text-[var(--color-text-primary)]">{formatTimeHM(status?.check_in_time)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 border border-rose-200/60">
              <LogOut className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Check-Out Time</p>
              <p className="mt-0.5 font-bold text-[var(--color-text-primary)]">{formatTimeHM(status?.check_out_time)}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[var(--color-surface-muted)] text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)]">
              <Clock3 className="h-4.5 w-4.5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-secondary)]">Total Duration</p>
              <p className="mt-0.5 font-bold text-[var(--color-text-primary)]">
                {status?.total_hours ? `${status.total_hours.toFixed(2)} hrs` : '---'}
              </p>
            </div>
          </div>
        </div>

        {canSkipLocation ? (
          <div className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-2.5 text-xs font-semibold text-emerald-800 border border-emerald-200/80">
          </div>
        ) : (
          status?.location_required && (
            <div className="flex items-center gap-2 rounded-2xl bg-[var(--color-surface-muted)] px-4 py-2.5 text-xs font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border-soft)]">
              <MapPin className="h-4 w-4 text-[var(--color-brand-gold)] shrink-0" />
              <span>GPS location validation is active. Coordinates are captured automatically upon punch.</span>
            </div>
          )
        )}
      </div>
    </CommonCard>
  );
};

export default MarkAttendanceCard;
