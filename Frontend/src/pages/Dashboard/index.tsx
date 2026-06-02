import React from 'react';
import { 
  Users, Calendar as CalendarIcon, TrendingUp, Scissors, 
  Clock, AlertCircle, Plus, ChevronRight,
  MoreVertical, Star
} from 'lucide-react';

import { isEmployeeDashboard } from '../../config/rbac';
import { ROUTE_PATHS } from '../../constants';
import { getUserDisplayName } from '../../redux/slices/auth/authSlice';
import { useAppSelector } from '../../redux/hooks';
import { useNavigate } from 'react-router-dom';
import { showToast } from '../../components/common/Toast/toastService';

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const user = useAppSelector((state) => state.auth.user);
  const orgId = useAppSelector((state) => state.auth.orgId);
  const selectedSalonId = useAppSelector((state) => state.auth.selectedSalonId);
  const isPersonalView = isEmployeeDashboard(user?.role);
  const displayName = getUserDisplayName(user) || 'there';

  const handleAddAppointment = () => {
    if (user?.role === 'super_admin') {
      if (!selectedSalonId) {
        showToast('warning', 'Select a salon from header before creating appointments');
        return;
      }
      navigate(`/${ROUTE_PATHS.ADMIN_APPOINTMENTS}`);
      return;
    }
    if (!orgId || orgId === 'system') {
      showToast('warning', 'Salon context is missing. Please sign in again.');
      return;
    }
    navigate(`/orgs/${orgId}/${ROUTE_PATHS.APPOINTMENTS}`);
  };

  return (
    <div className="max-w-[1600px] mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Welcome Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] font-['Outfit']">
            Good Morning, {displayName}
          </h1>
          <p className="text-[var(--color-text-secondary)] mt-1">
            {isPersonalView
              ? 'Your personal schedule and performance for today.'
              : "Here is what's happening at your salon today."}
          </p>
        </div>
        {!isPersonalView && (
          <div className="flex gap-3">
            <button className="flex items-center gap-2 px-5 py-2.5 bg-white border border-[var(--color-border-strong)] text-[var(--color-text-primary)] hover:bg-gray-50 rounded-xl text-sm font-semibold transition-all shadow-sm">
              <Users className="h-4 w-4 text-[var(--color-brand-gold)]" />
              New Walk-in
            </button>
            <button
              type="button"
              onClick={handleAddAppointment}
              className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-brand-gold)] text-white hover:bg-[var(--color-brand-gold-dark)] rounded-xl text-sm font-semibold transition-all shadow-md"
            >
              <Plus className="h-4 w-4" />
              Add Appointment
            </button>
          </div>
        )}
      </div>

      {/* Primary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {(isPersonalView
          ? [
              { label: 'My Appointments Today', value: '6', trend: '2 upcoming', icon: CalendarIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'My Revenue Today', value: '$420', trend: '+5%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'My Clients Served', value: '4', trend: 'On track', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'My Services Done', value: '5', trend: '1 in progress', icon: Scissors, color: 'text-[var(--color-brand-gold)]', bg: 'bg-[var(--color-brand-gold-light)]/20' },
            ]
          : [
              { label: "Today's Appointments", value: '42', trend: '+12%', icon: CalendarIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: "Revenue (Today)", value: '$3,240', trend: '+8.5%', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Walk-ins', value: '18', trend: '+24%', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
              { label: 'Services Completed', value: '28', trend: 'On track', icon: Scissors, color: 'text-[var(--color-brand-gold)]', bg: 'bg-[var(--color-brand-gold-light)]/20' },
            ]
        ).map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-soft border border-[var(--color-border-soft)] relative overflow-hidden group hover:border-[var(--color-brand-gold-light)] transition-all">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${stat.bg}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                stat.trend.includes('+') ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {stat.trend}
              </span>
            </div>
            <div>
              <p className="text-[var(--color-text-secondary)] text-sm font-medium">{stat.label}</p>
              <h3 className="text-3xl font-bold text-[var(--color-text-primary)] mt-1 font-['Outfit']">{stat.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Appointments Queue */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-soft border border-[var(--color-border-soft)] p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
              {isPersonalView ? 'My Upcoming Appointments' : 'Upcoming Appointments'}
            </h2>
            <button className="text-[var(--color-brand-gold-dark)] text-sm font-semibold flex items-center hover:underline">
              View Calendar <ChevronRight className="h-4 w-4 ml-1" />
            </button>
          </div>
          
          <div className="space-y-4">
            {(isPersonalView
              ? [
                  { time: '10:00 AM', client: 'Emma Thompson', service: 'Balayage & Cut', stylist: displayName, status: 'In Progress', statusColor: 'bg-blue-100 text-blue-700' },
                  { time: '11:00 AM', client: 'Michael Scott', service: "Men's Grooming", stylist: displayName, status: 'Upcoming', statusColor: 'bg-gray-100 text-gray-700' },
                ]
              : [
                  { time: '10:00 AM', client: 'Emma Thompson', service: 'Balayage & Cut', stylist: 'Sarah M.', status: 'In Progress', statusColor: 'bg-blue-100 text-blue-700' },
                  { time: '10:30 AM', client: 'Olivia Chen', service: 'Spa Pedicure', stylist: 'Jessica T.', status: 'Waiting', statusColor: 'bg-amber-100 text-amber-700' },
                  { time: '11:00 AM', client: 'Michael Scott', service: "Men's Grooming", stylist: 'David K.', status: 'Upcoming', statusColor: 'bg-gray-100 text-gray-700' },
                  { time: '11:15 AM', client: 'Sophia Davis', service: 'Bridal Trial', stylist: 'Sarah M.', status: 'Upcoming', statusColor: 'bg-gray-100 text-gray-700' },
                ]
            ).map((apt, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[70px]">
                    <span className="block text-sm font-bold text-[var(--color-text-primary)]">{apt.time.split(' ')[0]}</span>
                    <span className="block text-xs text-gray-500">{apt.time.split(' ')[1]}</span>
                  </div>
                  <div className="h-10 w-[2px] bg-gray-200 rounded-full"></div>
                  <div>
                    <h4 className="text-sm font-bold text-[var(--color-text-primary)]">{apt.client}</h4>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{apt.service} • with {apt.stylist}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${apt.statusColor}`}>
                    {apt.status}
                  </span>
                  <button className="text-gray-400 hover:text-gray-700">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alerts & Staff */}
        <div className="space-y-8">
          {/* Action Required */}
          <div className="bg-white rounded-2xl shadow-soft border border-[var(--color-border-soft)] p-6">
            <h2 className="text-lg font-bold text-[var(--color-text-primary)] mb-4">Action Required</h2>
            <div className="space-y-3">
              <div className="flex gap-3 items-start p-3 bg-red-50 rounded-xl">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-red-800">Low Stock Alert</h4>
                  <p className="text-xs text-red-600 mt-1">Olaplex No.3 (2 left) and L'Oreal Developer (1 left).</p>
                </div>
              </div>
              <div className="flex gap-3 items-start p-3 bg-amber-50 rounded-xl">
                <Clock className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-amber-800">Pending Approvals</h4>
                  <p className="text-xs text-amber-600 mt-1">3 staff leave requests require your approval.</p>
                </div>
              </div>
            </div>
          </div>

          {!isPersonalView && (
            <div className="bg-white rounded-2xl shadow-soft border border-[var(--color-border-soft)] p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-[var(--color-text-primary)]">Top Staff Today</h2>
                <Star className="h-4 w-4 text-[var(--color-brand-gold)]" />
              </div>
              <div className="space-y-4">
                {[
                  { name: 'Sarah M.', role: 'Senior Stylist', rev: '$840', avatar: 'SM' },
                  { name: 'Jessica T.', role: 'Esthetician', rev: '$520', avatar: 'JT' },
                  { name: 'David K.', role: 'Barber', rev: '$310', avatar: 'DK' },
                ].map((staff, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                        {staff.avatar}
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{staff.name}</h4>
                        <p className="text-xs text-[var(--color-text-secondary)]">{staff.role}</p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-[var(--color-brand-gold-dark)]">{staff.rev}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
