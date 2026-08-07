import { useEffect, useRef } from 'react';
import { useGetRegisterTodayAppointmentsQuery } from '../redux/slices/appointments/appointmentsApi';
import { showToast } from '../components/common/Toast/toastService';

export const useAppointmentNotifications = (salonId?: string) => {
  const notifiedSetRef = useRef<Set<string>>(new Set());

  const { data: todayData } = useGetRegisterTodayAppointmentsQuery(
    { salon_id: salonId || '' },
    { skip: !salonId, pollingInterval: 30000 }
  );

  useEffect(() => {
    // Request Notification permission if browser supports it
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!todayData?.data?.items?.length) return;

    const checkNotifications = () => {
      const now = new Date().getTime();

      todayData.data.items.forEach((appt) => {
        if (!appt.start_datetime || notifiedSetRef.current.has(appt.id)) return;
        if (appt.status === 'COMPLETED' || appt.status === 'CANCELLED') return;

        const apptTime = new Date(appt.start_datetime).getTime();
        const diffMs = apptTime - now;
        const diffMinutes = diffMs / (1000 * 60);

        // Notify if appointment starts in 5 minutes or less (and hasn't passed more than 1 min ago)
        if (diffMinutes > 0 && diffMinutes <= 5) {
          notifiedSetRef.current.add(appt.id);
          const msg = `Upcoming Appointment in ${Math.ceil(diffMinutes)} mins: ${appt.customer_name} (${appt.customer_phone}) at ${appt.appointment_time}`;

          showToast('info', msg);

          if ('Notification' in window && Notification.permission === 'granted') {
            try {
              new Notification('Upcoming Appointment Alert', {
                body: msg,
                icon: '/favicon.ico',
              });
            } catch (err) {
              // Ignore notification permission / support errors
            }
          }
        }
      });
    };

    checkNotifications();
    const interval = setInterval(checkNotifications, 15000);
    return () => clearInterval(interval);
  }, [todayData]);
};
