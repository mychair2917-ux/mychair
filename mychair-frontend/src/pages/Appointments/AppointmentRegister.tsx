import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarDays, ReceiptText } from 'lucide-react';
import { AppointmentRegisterPanel } from '../../components/appointments/AppointmentRegisterPanel';
import { TodayAppointmentItem } from '../../redux/slices/appointments/Types';
import { useAppSelector } from '../../redux/hooks';
import { ROUTE_PATHS } from '../../constants';
import { Button } from '../../components/common';

const AppointmentRegister: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  
  const storedOrgId = useAppSelector((state) => state.auth.orgId);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId);
  const role = useAppSelector((state) => state.auth.user?.role);
  const isSuperAdmin = role === 'super_admin';
  const salonId = (orgId ?? (isSuperAdmin ? selectedSalonId : storedOrgId) ?? '').trim();

  const handleSelectAppointmentForBilling = (appt: TodayAppointmentItem) => {
    // Navigate to Billing page with appointment ID
    const basePath = orgId ? `/org/${orgId}` : '/admin';
    const billingPath = `${basePath}/${ROUTE_PATHS.APPOINTMENTS}`;
    navigate(billingPath, { state: { preselectAppointment: appt } });
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-bg)]/30 p-4 md:p-6 lg:p-8">
      <div className="mx-auto max-w-[1600px] space-y-6">
        {/* Page header */}
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2.5 inline-flex items-center gap-2 rounded-full bg-[var(--color-brand-gold)]/10 px-3.5 py-1 text-xs font-semibold text-[var(--color-brand-gold-dark)]">
              <CalendarDays className="h-3.5 w-3.5" />
              Appointments Register
            </div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] md:text-3xl">
              Appointments
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Manage today's scheduled appointments.
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              onClick={() => {
                const basePath = orgId ? `/orgs/${orgId}` : '/admin';
                navigate(`${basePath}/${ROUTE_PATHS.APPOINTMENTS}`);
              }}
              className="flex items-center gap-2"
            >
              <ReceiptText className="h-4 w-4" />
              Go to Billing
            </Button>
          </div>
        </div>

        <AppointmentRegisterPanel
          salonId={salonId}
          onSelectAppointmentForBilling={handleSelectAppointmentForBilling}
        />
      </div>
    </div>
  );
};

export default AppointmentRegister;
