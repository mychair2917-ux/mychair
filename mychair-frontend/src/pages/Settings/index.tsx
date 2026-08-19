import React, { useState } from 'react';
import { MapPin, MessageSquare, ShieldAlert } from 'lucide-react';
import AttendanceLocationSettings from '../../components/attendance/AttendanceLocationSettings';
import { MembershipSettingsComponent } from '../../components/membership/MembershipSettingsComponent';
import { useAppSelector } from '../../redux/hooks';
import { WhatsAppSettingsTab } from '../../components/whatsapp/WhatsAppSettingsTab';
import { AdminWhatsAppOverview } from '../../components/whatsapp/AdminWhatsAppOverview';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'attendance' | 'admin_whatsapp'>('whatsapp');
  const user = useAppSelector((state) => state.auth.user);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId) || user?.salon_id || 'default';
  const isSuperAdmin = user?.role === 'super_admin';

  return (
    <div className="space-y-6 p-4 sm:p-6 bg-slate-950 text-slate-100 min-h-screen">
      <div>
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="mt-1 text-sm text-slate-400">
          Manage salon location preferences, attendance tracking, membership configurations, and multi-tenant WhatsApp Cloud API communications.
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <button
          onClick={() => setActiveTab('whatsapp')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all inline-flex items-center gap-2 ${
            activeTab === 'whatsapp'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          WhatsApp Integration
        </button>

        <button
          onClick={() => setActiveTab('attendance')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all inline-flex items-center gap-2 ${
            activeTab === 'attendance'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Attendance & Location
        </button>

        {isSuperAdmin && (
          <button
            onClick={() => setActiveTab('admin_whatsapp')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all inline-flex items-center gap-2 ${
              activeTab === 'admin_whatsapp'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-500/30'
                : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            Admin WhatsApp Overview
          </button>
        )}
      </div>

      {/* Active Tab Content */}
      {activeTab === 'whatsapp' && <WhatsAppSettingsTab salonId={selectedSalonId} />}

      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <MembershipSettingsComponent />
          <AttendanceLocationSettings />
        </div>
      )}

      {activeTab === 'admin_whatsapp' && isSuperAdmin && <AdminWhatsAppOverview />}
    </div>
  );
};

export default Settings;
