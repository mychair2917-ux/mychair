import React, { useState, useEffect, useMemo } from 'react';
import {
  CalendarDays,
  Clock,
  Users,
  CheckCircle2,
  Receipt,
  RefreshCw,
  Trash2,
  Timer,
} from 'lucide-react';
import { Button, Input } from '../common';
import { 
  useGetRegisterTodayAppointmentsQuery,
  useDeleteAppointmentMutation,
} from '../../redux/slices/appointments/appointmentsApi';
import { TodayAppointmentItem } from '../../redux/slices/appointments/Types';
import { AppointmentQuickEntry } from './AppointmentQuickEntry';
import { showToast } from '../common/Toast/toastService';

interface AppointmentRegisterPanelProps {
  salonId: string;
  onSelectAppointmentForBilling: (appointment: TodayAppointmentItem) => void;
}

const NextBookingCountdown: React.FC<{
  nextAppt: TodayAppointmentItem | undefined;
  fallbackSummaryNext?: { customer_name: string; time: string } | null;
}> = ({ nextAppt, fallbackSummaryNext }) => {
  const [timeLeft, setTimeLeft] = useState<{
    text: string;
    subtext: string;
    isOverdue: boolean;
    isNow: boolean;
  }>({
    text: 'No active queue',
    subtext: 'No upcoming bookings',
    isOverdue: false,
    isNow: false,
  });

  useEffect(() => {
    const updateTimer = () => {
      if (!nextAppt && !fallbackSummaryNext) {
        setTimeLeft({
          text: 'No active queue',
          subtext: 'No upcoming bookings',
          isOverdue: false,
          isNow: false,
        });
        return;
      }

      let targetDate: Date | null = null;

      if (nextAppt) {
        if (nextAppt.start_datetime) {
          targetDate = new Date(nextAppt.start_datetime);
        } else if (nextAppt.appointment_date && nextAppt.appointment_time) {
          const parts = nextAppt.appointment_time.split(':');
          const h = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          targetDate = new Date(nextAppt.appointment_date);
          targetDate.setHours(isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0);
        }
      } else if (fallbackSummaryNext?.time) {
        const today = new Date();
        const parts = fallbackSummaryNext.time.split(':');
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        targetDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), isNaN(h) ? 0 : h, isNaN(m) ? 0 : m, 0, 0);
      }

      if (!targetDate || isNaN(targetDate.getTime())) {
        const name = nextAppt?.customer_name || fallbackSummaryNext?.customer_name || 'Upcoming';
        const timeStr = nextAppt?.appointment_time || fallbackSummaryNext?.time || '';
        setTimeLeft({
          text: name,
          subtext: timeStr ? `Scheduled at ${timeStr}` : 'Scheduled',
          isOverdue: false,
          isNow: false,
        });
        return;
      }

      const now = new Date();
      const diffMs = targetDate.getTime() - now.getTime();
      const diffSec = Math.floor(diffMs / 1000);

      const customerName = nextAppt?.customer_name || fallbackSummaryNext?.customer_name || 'Client';

      if (diffSec > 0) {
        const hrs = Math.floor(diffSec / 3600);
        const mins = Math.floor((diffSec % 3600) / 60);
        const secs = diffSec % 60;

        let formatted = '';
        if (hrs > 0) {
          formatted = `${hrs}h ${mins}m ${secs}s`;
        } else if (mins > 0) {
          formatted = `${mins}m ${secs}s`;
        } else {
          formatted = `${secs}s`;
        }

        setTimeLeft({
          text: formatted,
          subtext: `${customerName} (${targetDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })})`,
          isOverdue: false,
          isNow: false,
        });
      } else if (diffSec >= -1800) {
        const overdueSec = Math.abs(diffSec);
        const mins = Math.floor(overdueSec / 60);
        const secs = overdueSec % 60;
        setTimeLeft({
          text: mins === 0 ? 'Starting Now' : `Overdue ${mins}m ${secs}s`,
          subtext: `${customerName} (${targetDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })})`,
          isOverdue: mins > 0,
          isNow: mins === 0,
        });
      } else {
        setTimeLeft({
          text: 'No active queue',
          subtext: 'No upcoming bookings',
          isOverdue: false,
          isNow: false,
        });
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [nextAppt, fallbackSummaryNext]);

  return (
    <div className="flex items-center justify-between rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-5 shadow-soft hover:shadow-card transition-shadow">
      <div>
        <div className="flex items-center gap-1.5">
          <p className="font-semibold text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">
            Upcoming Next (Countdown)
          </p>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        </div>
        <h4 className={`font-mono font-extrabold text-xl mt-1 tracking-tight ${
          timeLeft.isOverdue ? 'text-rose-600 animate-pulse' : timeLeft.isNow ? 'text-emerald-600 font-bold' : 'text-[var(--color-brand-gold-dark)]'
        }`}>
          {timeLeft.text}
        </h4>
        <p className="text-[11px] font-medium text-[var(--color-text-secondary)] mt-0.5 truncate max-w-[170px]" title={timeLeft.subtext}>
          {timeLeft.subtext}
        </p>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 border border-amber-200/50">
        <Timer className="h-5 w-5" />
      </div>
    </div>
  );
};

function formatTimeTo12Hour(timeStr?: string, startDatetime?: string): string {
  if (startDatetime) {
    const rawIso =
      typeof startDatetime === 'string' &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(startDatetime) &&
      !startDatetime.endsWith('Z') &&
      !/[+-]\d{2}:\d{2}$/.test(startDatetime)
        ? `${startDatetime}Z`
        : startDatetime;
    const d = new Date(rawIso);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
  }
  if (!timeStr) return '-';
  if (/am|pm/i.test(timeStr)) {
    return timeStr;
  }
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1].padStart(2, '0');
    if (!isNaN(hours)) {
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      if (hours === 0) hours = 12;
      return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
    }
  }
  return timeStr;
}

export const AppointmentRegisterPanel: React.FC<AppointmentRegisterPanelProps> = ({
  salonId,
  onSelectAppointmentForBilling,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [deleteAppointment] = useDeleteAppointmentMutation();

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete the appointment for ${name}?`)) {
      return;
    }
    try {
      await deleteAppointment(id).unwrap();
      showToast('success', 'Appointment deleted successfully');
    } catch (error) {
      showToast('error', 'Failed to delete appointment');
    }
  };

  const localDateStr = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().split('T')[0];
  const {
    data: registerData,
    isLoading,
    refetch,
  } = useGetRegisterTodayAppointmentsQuery(
    { salon_id: salonId, search: searchQuery, date: localDateStr },
    { skip: !salonId, pollingInterval: 30000 }
  );

  const summary = registerData?.data?.summary;
  const rawItems = registerData?.data?.items || [];

  // Filter out Walk-ins and completed/billed/cancelled appointments from Upcoming Bookings section
  const appointmentOnlyItems = useMemo(() => {
    return rawItems.filter((item) => {
      if (item.type === 'Walk-in') return false;
      const statusUpper = (item.status || '').toUpperCase();
      return statusUpper !== 'COMPLETED' && statusUpper !== 'BILLED' && statusUpper !== 'CANCELLED';
    });
  }, [rawItems]);

  // Find next upcoming appointment
  const nextAppt = useMemo(() => {
    const upcomingList = appointmentOnlyItems.filter(
      (item) => item.status !== 'COMPLETED' && item.status !== 'CANCELLED'
    );
    if (upcomingList.length === 0) return undefined;
    
    const now = new Date();
    // Sort by proximity to now
    return upcomingList.sort((a, b) => {
      let timeA = new Date().getTime();
      let timeB = new Date().getTime();
      if (a.start_datetime) {
        timeA = new Date(a.start_datetime).getTime();
      } else if (a.appointment_date && a.appointment_time) {
        const [h, m] = a.appointment_time.split(':').map(Number);
        const d = new Date(a.appointment_date);
        d.setHours(h || 0, m || 0, 0, 0);
        timeA = d.getTime();
      }
      if (b.start_datetime) {
        timeB = new Date(b.start_datetime).getTime();
      } else if (b.appointment_date && b.appointment_time) {
        const [h, m] = b.appointment_time.split(':').map(Number);
        const d = new Date(b.appointment_date);
        d.setHours(h || 0, m || 0, 0, 0);
        timeB = d.getTime();
      }
      return Math.abs(timeA - now.getTime()) - Math.abs(timeB - now.getTime());
    })[0];
  }, [appointmentOnlyItems]);

  const pendingAppointmentsCount = useMemo(() => {
    return appointmentOnlyItems.filter((i) => i.status !== 'COMPLETED' && i.status !== 'CANCELLED').length;
  }, [appointmentOnlyItems]);

  return (
    <div className="space-y-6">
      {/* ─── Dashboard Summary Cards ───────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center justify-between rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-5 shadow-soft hover:shadow-card transition-shadow">
          <div>
            <p className="font-semibold text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">
              Today's Bookings
            </p>
            <h4 className="font-bold text-2xl text-[var(--color-text-primary)] mt-1">
              {summary?.today_appointments ?? appointmentOnlyItems.length}
            </h4>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Scheduled appointments</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <CalendarDays className="h-5 w-5" />
          </div>
        </div>

        <NextBookingCountdown nextAppt={nextAppt} fallbackSummaryNext={summary?.next_upcoming} />

        <div className="flex items-center justify-between rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-5 shadow-soft hover:shadow-card transition-shadow">
          <div>
            <p className="font-semibold text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">
              Pending Visits
            </p>
            <h4 className="font-bold text-2xl text-[var(--color-text-primary)] mt-1">
              {pendingAppointmentsCount}
            </h4>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Awaiting service</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-purple-50 text-purple-700">
            <Users className="h-5 w-5" />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-5 shadow-soft hover:shadow-card transition-shadow">
          <div>
            <p className="font-semibold text-xs text-[var(--color-text-secondary)] uppercase tracking-wider">
              Completed Today
            </p>
            <h4 className="font-bold text-2xl text-[var(--color-text-primary)] mt-1">
              {summary?.completed_today ?? 0}
            </h4>
            <p className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">Finished & billed</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* ─── Quick Entry Panel ──────────────────────────────── */}
      <AppointmentQuickEntry salonId={salonId} onAppointmentCreated={refetch} />

      {/* ─── Active Appointments Register ──────────────────── */}
      <div className="rounded-[1.5rem] border border-[var(--color-border-soft)] bg-white p-6 shadow-soft">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-bold text-[var(--color-text-primary)] text-lg">Upcoming Bookings</h3>
            <p className="text-xs text-[var(--color-text-secondary)]">Manage active scheduled visits and appointment queue</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex bg-[var(--color-surface-bg)] rounded-xl p-1 border border-[var(--color-border-soft)]">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === 'table' ? 'bg-[var(--color-brand-gold)] text-white shadow-xs' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Table
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  viewMode === 'calendar' ? 'bg-[var(--color-brand-gold)] text-white shadow-xs' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Calendar
              </button>
            </div>
            
            <div className="w-full sm:w-64">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, phone, date..."
                className="w-full text-xs"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              title="Refresh Register"
              className="p-2.5"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-[var(--color-text-secondary)]">Loading today's register...</div>
        ) : appointmentOnlyItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-bg)]/50 p-8 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-[var(--color-text-tertiary)]" />
            <p className="mt-2 font-bold text-sm text-[var(--color-text-primary)]">No active upcoming appointments</p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1">
              Add a new appointment above to schedule a client visit.
            </p>
          </div>
        ) : (
          viewMode === 'calendar' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {appointmentOnlyItems.map((appt) => (
                <div key={appt.id} className="rounded-2xl border border-[var(--color-border-soft)] bg-white p-4 hover:border-[var(--color-brand-gold-light)] transition-all shadow-xs flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--color-text-primary)]">
                        <Clock className="h-4 w-4 text-[var(--color-brand-gold)]" />
                        {formatTimeTo12Hour(appt.appointment_time, appt.start_datetime)}
                      </span>
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/50">
                        {appt.type || 'Appointment'}
                      </span>
                    </div>
                    <h4 className="font-bold text-[var(--color-text-primary)] text-base">{appt.customer_name}</h4>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-1">{appt.customer_phone}</p>
                    {appt.notes ? (
                      <div className="mt-2 text-xs bg-[var(--color-surface-bg)] p-2 rounded-xl text-[var(--color-text-secondary)] italic line-clamp-2" title={appt.notes}>
                        {appt.notes}
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-[var(--color-text-tertiary)] italic">
                        Add optional notes
                      </div>
                    )}
                  </div>
                  <div className="mt-4 pt-4 border-t border-[var(--color-border-soft)] flex items-center justify-between">
                    <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200/50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                      {appt.status}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(appt.id, appt.customer_name)}
                        className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                        title="Delete Appointment"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => onSelectAppointmentForBilling(appt)}
                        className="gap-1.5 px-3 py-1.5 text-xs"
                      >
                        <Receipt className="h-3.5 w-3.5" />
                        Open in Billing
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-[var(--color-border-soft)] bg-white shadow-soft">
              <div className="custom-scrollbar overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--color-surface-bg)] text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider border-b border-[var(--color-border-soft)]">
                    <tr>
                      <th className="py-3.5 px-4">Time</th>
                      <th className="py-3.5 px-4">Customer</th>
                      <th className="py-3.5 px-4">Mobile</th>
                      <th className="py-3.5 px-4">Type</th>
                      <th className="py-3.5 px-4">Notes</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border-soft)]">
                    {appointmentOnlyItems.map((appt) => (
                      <tr key={appt.id} className="hover:bg-[var(--color-surface-bg)]/70 transition-colors">
                        <td className="py-3.5 px-4 font-bold text-[var(--color-text-primary)] flex items-center gap-1.5 whitespace-nowrap">
                          <Clock className="h-3.5 w-3.5 text-[var(--color-brand-gold)]" />
                          {formatTimeTo12Hour(appt.appointment_time, appt.start_datetime)}
                        </td>
                        <td className="py-3.5 px-4 font-medium text-[var(--color-text-primary)]">
                          {appt.customer_name}
                        </td>
                        <td className="py-3.5 px-4 text-[var(--color-text-secondary)]">{appt.customer_phone}</td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200/50">
                            {appt.type || 'Appointment'}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-[var(--color-text-secondary)] max-w-[220px]">
                          {appt.notes ? (
                            <span className="truncate block font-medium text-[var(--color-text-primary)]" title={appt.notes}>
                              {appt.notes}
                            </span>
                          ) : (
                            <span className="text-[var(--color-text-tertiary)] italic">Add optional notes</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center rounded-full bg-amber-50 border border-amber-200/50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            {appt.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDelete(appt.id, appt.customer_name)}
                              className="p-1.5 text-red-600 hover:bg-red-50 hover:text-red-700"
                              title="Delete Appointment"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => onSelectAppointmentForBilling(appt)}
                              className="gap-1.5 px-3 py-1.5 text-xs"
                            >
                              <Receipt className="h-3.5 w-3.5" />
                              Open in Billing
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};
