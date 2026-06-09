import React, { useState } from 'react';
import { useSelector } from 'react-redux';

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

  const usesEmployeeFirstFlow =
    isSuperAdmin(role) ||
    normalizedRole === ROLES.SALON_OWNER ||
    normalizedRole === ROLES.SALON_ADMIN;

  const canMarkOwnAttendance =
    normalizedRole === ROLES.EMPLOYEE ||
    normalizedRole === ROLES.SALON_MANAGER ||
    normalizedRole === ROLES.SALON_OWNER ||
    isSuperAdmin(role);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Attendance</h1>
        <p className="mt-1 text-sm text-gray-500">
          {usesEmployeeFirstFlow
            ? 'Select an employee to review attendance records.'
            : 'Mark your daily attendance and review your records.'}
        </p>
      </div>

      {canMarkOwnAttendance && !usesEmployeeFirstFlow && <MarkAttendanceCard />}

      {usesEmployeeFirstFlow ? (
        <>
          <EmployeeAttendanceSelector
            selectedEmployee={selectedEmployee}
            onSelect={setSelectedEmployee}
          />
          <AttendanceRecords
            selectedEmployee={selectedEmployee}
            showEmployeeSummary
          />
        </>
      ) : (
        <AttendanceRecords />
      )}
    </div>
  );
};

export default Attendance;
