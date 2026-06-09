import React from 'react';
import { CalendarCheck, CalendarX, Clock3, Palmtree, UserCheck } from 'lucide-react';

import { AttendanceSummary } from '../../redux/slices/attendance/attendanceApi';
import { CommonCard } from '../common';

interface AttendanceSummaryCardsProps {
  summary?: AttendanceSummary;
  loading?: boolean;
}

const cards = [
  { key: 'present_count', label: 'Present', icon: UserCheck, tone: 'text-emerald-600 bg-emerald-50' },
  { key: 'late_count', label: 'Late', icon: Clock3, tone: 'text-amber-600 bg-amber-50' },
  { key: 'absent_count', label: 'Absent', icon: CalendarX, tone: 'text-rose-600 bg-rose-50' },
  { key: 'week_off_count', label: 'Week Off', icon: Palmtree, tone: 'text-sky-600 bg-sky-50' },
] as const;

const AttendanceSummaryCards: React.FC<AttendanceSummaryCardsProps> = ({ summary, loading }) => {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.key} className="h-24 animate-pulse rounded-3xl bg-[var(--color-surface-muted)]" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          const value = summary?.[card.key] ?? 0;
          return (
            <CommonCard key={card.key} className="!shadow-none">
              <div className="flex items-center gap-4 p-4">
                <div className={`rounded-2xl p-3 ${card.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-semibold text-gray-900">{value}</p>
                </div>
              </div>
            </CommonCard>
          );
        })}
      </div>
      <CommonCard className="!shadow-none">
        <div className="flex items-center gap-4 p-4">
          <div className="rounded-2xl bg-[var(--color-surface-muted)] p-3 text-[var(--color-brand-gold)]">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Worked Hours</p>
            <p className="text-2xl font-semibold text-gray-900">
              {summary?.total_work_hours ? `${summary.total_work_hours.toFixed(1)} hrs` : '0 hrs'}
            </p>
          </div>
        </div>
      </CommonCard>
    </div>
  );
};

export default AttendanceSummaryCards;
