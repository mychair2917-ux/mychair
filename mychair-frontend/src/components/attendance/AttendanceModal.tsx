import React, { useEffect, useState } from 'react';
import { AlertCircle, Calendar as CalendarIcon, Clock } from 'lucide-react';

import {
  type AttendanceRecord,
  useManualUpdateAttendanceMutation,
} from '../../redux/slices/attendance/attendanceApi';
import type { EmployeeListItem } from '../../redux/slices/employees/Types';
import { getApiErrorMessage } from '../../utils/apiErrors';
import {
  Button,
  CommonModal,
  FormField,
  Input,
  Select,
  showToast,
} from '../common';

interface AttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  record?: AttendanceRecord | null;
  employee?: EmployeeListItem | null;
  onSuccess?: () => void;
}

const statusOptions = [
  { value: 'PRESENT', label: 'Present' },
  { value: 'LATE', label: 'Late' },
  { value: 'HALF_DAY', label: 'Half Day' },
  { value: 'ABSENT', label: 'Absent' },
  { value: 'LEAVE', label: 'Leave' },
  { value: 'WEEK_OFF', label: 'Week Off' },
];

export const AttendanceModal: React.FC<AttendanceModalProps> = ({
  isOpen,
  onClose,
  record,
  employee,
  onSuccess,
}) => {
  const [updateAttendance, { isLoading }] = useManualUpdateAttendanceMutation();
  const [status, setStatus] = useState<string>('PRESENT');
  const [attendanceDate, setAttendanceDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [checkInTime, setCheckInTime] = useState<string>('');
  const [checkOutTime, setCheckOutTime] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (record) {
      setStatus(record.status || 'PRESENT');
      setAttendanceDate(record.attendance_date || new Date().toISOString().slice(0, 10));
      if (record.check_in_time) {
        const d = new Date(record.check_in_time);
        setCheckInTime(d.toTimeString().slice(0, 5));
      } else {
        setCheckInTime('');
      }
      if (record.check_out_time) {
        const d = new Date(record.check_out_time);
        setCheckOutTime(d.toTimeString().slice(0, 5));
      } else {
        setCheckOutTime('');
      }
      setNotes(record.notes || '');
      setErrorMessage(null);
    } else {
      setStatus('PRESENT');
      setAttendanceDate(new Date().toISOString().slice(0, 10));
      setCheckInTime('');
      setCheckOutTime('');
      setNotes('');
      setErrorMessage(null);
    }
  }, [record, isOpen]);

  if (!record && !employee) return null;

  const targetName = record?.employee_name || employee?.full_name || 'employee';
  const targetDate = record?.attendance_date || attendanceDate;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    try {
      let fullCheckIn: string | undefined = undefined;
      let fullCheckOut: string | undefined = undefined;

      if (checkInTime && targetDate) {
        fullCheckIn = new Date(`${targetDate}T${checkInTime}:00`).toISOString();
      }
      if (checkOutTime && targetDate) {
        fullCheckOut = new Date(`${targetDate}T${checkOutTime}:00`).toISOString();
      }

      await updateAttendance({
        attendance_id: record?.id,
        employee_id: record?.employee_id || employee?.id,
        attendance_date: targetDate,
        status,
        check_in_time: fullCheckIn,
        check_out_time: fullCheckOut,
        notes: notes.trim() || undefined,
      }).unwrap();

      showToast('success', record ? 'Attendance record updated successfully' : 'Attendance marked successfully');
      onSuccess?.();
      onClose();
    } catch (err) {
      const msg = getApiErrorMessage(err, 'Failed to update attendance');
      setErrorMessage(msg);
      showToast('error', msg);
    }
  };

  return (
    <CommonModal
      open={isOpen}
      onClose={onClose}
      title={record ? "Update Attendance Record" : `Mark Attendance - ${targetName}`}
      subtitle={
        record
          ? `Modify status or timestamps for ${targetName} on ${record.attendance_date}`
          : `Set attendance status or punch times for ${targetName}`
      }
      size="md"
      footer={
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading} onClick={handleSave}>
            {record ? 'Save Changes' : 'Mark Attendance'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSave} className="space-y-4 pt-1">
        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid gap-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Staff / Manager</p>
            <p className="mt-0.5 text-sm font-bold text-gray-900">{targetName}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Attendance Date</p>
            {record ? (
              <p className="mt-0.5 text-sm font-bold text-gray-900">{record.attendance_date}</p>
            ) : (
              <div className="relative mt-1">
                <CalendarIcon className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                <Input
                  type="date"
                  value={attendanceDate}
                  onChange={(e) => setAttendanceDate(e.target.value)}
                  className="h-8 pl-8 text-xs font-semibold rounded-lg border-gray-200"
                />
              </div>
            )}
          </div>
        </div>

        <FormField label="Attendance Status" name="status" required>
          <Select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={statusOptions}
            className="rounded-xl border-gray-200"
          />
        </FormField>

        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Check-In Time" name="check_in_time">
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="check_in_time"
                type="time"
                value={checkInTime}
                onChange={(e) => setCheckInTime(e.target.value)}
                className="pl-9.5 rounded-xl border-gray-200"
              />
            </div>
          </FormField>

          <FormField label="Check-Out Time" name="check_out_time">
            <div className="relative">
              <Clock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                id="check_out_time"
                type="time"
                value={checkOutTime}
                onChange={(e) => setCheckOutTime(e.target.value)}
                className="pl-9.5 rounded-xl border-gray-200"
              />
            </div>
          </FormField>
        </div>

        <FormField label="Notes & Remarks" name="notes">
          <textarea
            id="notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for manual edit or shift comments..."
            className="w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/20"
          />
        </FormField>
      </form>
    </CommonModal>
  );
};

export default AttendanceModal;
