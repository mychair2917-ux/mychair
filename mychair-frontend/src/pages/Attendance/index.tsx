import React, { useState } from 'react';
import { Calendar, MapPin } from 'lucide-react';
import { useSelector } from 'react-redux';

import AttendanceLocationSettings from '../../components/attendance/AttendanceLocationSettings';
import AttendanceRecords from '../../components/attendance/AttendanceRecords';
import EmployeeAttendanceSelector from '../../components/attendance/EmployeeAttendanceSelector';
import MarkAttendanceCard from '../../components/attendance/MarkAttendanceCard';
import { ROLES } from '../../constants';
import { isSuperAdmin, normalizeRole } from '../../config/rbac';
import type { EmployeeListItem } from '../../redux/slices/employees/Types';
import type { RootState } from '../../redux/store';

const Attendance: React.FC = () => {
  const role = useSelector((state: RootState) => state.auth.user?.role);
  const normalizedRole = normalizeRole(role);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeListItem | null>(null);
  const [showLocationSettings, setShowLocationSettings] = useState(false);

  const usesEmployeeFirstFlow =
    isSuperAdmin(role) ||
    normalizedRole === ROLES.SALON_OWNER ||
    normalizedRole === ROLES.SALON_ADMIN;

  const canMarkOwnAttendance =
    normalizedRole === ROLES.EMPLOYEE ||
    normalizedRole === ROLES.SALON_MANAGER ||
    normalizedRole === ROLES.SALON_OWNER ||
    isSuperAdmin(role);

  const canConfigureLocation =
    isSuperAdmin(role) ||
    normalizedRole === ROLES.SALON_OWNER ||
    normalizedRole === ROLES.SALON_ADMIN;

  const todayFormatted = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-4 md:p-6 lg:p-8">
      {/* Header Banner aligned with app theme */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-[var(--color-border-soft)] bg-white p-6 shadow-soft">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-[var(--color-brand-gold)] animate-pulse" />
            <span className="rounded-full bg-[var(--color-surface-muted)] px-3 py-0.5 text-xs font-semibold text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)]">
              Workforce Management
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)] sm:text-3xl">
            Attendance Dashboard
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] max-w-2xl">
            {usesEmployeeFirstFlow
              ? 'Select staff members to review attendance records, check-in history, and monthly shift performance.'
              : 'Mark your daily attendance punch and review your working hours history.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-muted)] px-4 py-2.5">
            <Calendar className="h-4 w-4 text-[var(--color-brand-gold)]" />
            <span className="text-xs font-semibold text-[var(--color-text-primary)]">{todayFormatted}</span>
          </div>

          {canConfigureLocation && (
            <button
              type="button"
              onClick={() => setShowLocationSettings((prev) => !prev)}
              className="flex items-center gap-2 rounded-2xl border border-[var(--color-border-strong)] bg-white px-4 py-2.5 text-xs font-semibold text-[var(--color-text-primary)] transition-all hover:bg-[var(--color-surface-bg)] shadow-xs"
            >
              <MapPin className="h-4 w-4 text-[var(--color-brand-gold)]" />
              {showLocationSettings ? 'Hide Location Settings' : 'GPS Location Settings'}
            </button>
          )}
        </div>
      </div>

      {showLocationSettings && canConfigureLocation && (
        <div className="transition-all duration-300">
          <AttendanceLocationSettings />
        </div>
      )}

      {usesEmployeeFirstFlow ? (
        <>
          <EmployeeAttendanceSelector
            selectedEmployee={selectedEmployee}
            onSelect={setSelectedEmployee}
          />
          <MarkAttendanceCard employee={selectedEmployee} />
          <AttendanceRecords
            selectedEmployee={selectedEmployee}
            showEmployeeSummary
          />
        </>
      ) : (
        <>
          {canMarkOwnAttendance && <MarkAttendanceCard />}
          <AttendanceRecords />
        </>
      )}
    </div>
  );
};

export default Attendance;
