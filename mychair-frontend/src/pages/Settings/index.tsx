import React, { useState } from 'react';
import { MapPin, MessageSquare, ShieldAlert } from 'lucide-react';
import AttendanceLocationSettings from '../../components/attendance/AttendanceLocationSettings';
import { MembershipSettingsComponent } from '../../components/membership/MembershipSettingsComponent';
import { useAppSelector } from '../../redux/hooks';
import { WhatsAppSettingsTab } from '../../components/whatsapp/WhatsAppSettingsTab';
import { AdminWhatsAppOverview } from '../../components/whatsapp/AdminWhatsAppOverview';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'whatsapp' | 'admin_whatsapp'>('whatsapp');
  const user = useAppSelector((state) => state.auth.user);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId) || user?.salon_id || 'default';
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <div className="space-y-6 p-4 sm:p-6 bg-slate-950 text-slate-100 min-h-screen">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Manage salon preferences, membership duration settings, and attendance configuration.
        </p>
      </div>

      <MembershipSettingsComponent />

      <AttendanceLocationSettings />
    </div>
  );
};

export default Settings;
