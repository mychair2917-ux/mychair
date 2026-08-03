import React from 'react';
import {
  CalendarCheck,
  CalendarX,
  Clock3,
  Palmtree,
  Plane,
  UserCheck,
  Briefcase,
  Users,
} from 'lucide-react';

import type { AttendanceSummary } from '../../redux/slices/attendance/attendanceApi';
import { CommonCard } from '../common';

interface AttendanceSummaryCardsProps {
  summary?: AttendanceSummary;
  loading?: boolean;
}

const summaryConfig = [
  {
    key: 'present_count',
    label: 'Present',
    icon: UserCheck,
    bgTone: 'bg-emerald-50/70 hover:bg-emerald-50',
    iconTone: 'bg-emerald-500/10 text-emerald-600 border border-emerald-200/60',
    badgeTone: 'bg-emerald-100 text-emerald-800',
    borderColor: 'border-emerald-200/70 hover:border-emerald-300',
  },
  {
    key: 'late_count',
    label: 'Late',
    icon: Clock3,
    bgTone: 'bg-amber-50/70 hover:bg-amber-50',
    iconTone: 'bg-amber-500/10 text-amber-600 border border-amber-200/60',
    badgeTone: 'bg-amber-100 text-amber-800',
    borderColor: 'border-amber-200/70 hover:border-amber-300',
  },
  {
    key: 'absent_count',
    label: 'Absent',
    icon: CalendarX,
    bgTone: 'bg-rose-50/70 hover:bg-rose-50',
    iconTone: 'bg-rose-500/10 text-rose-600 border border-rose-200/60',
    badgeTone: 'bg-rose-100 text-rose-800',
    borderColor: 'border-rose-200/70 hover:border-rose-300',
  },
  {
    key: 'half_day_count',
    label: 'Half Day',
    icon: Briefcase,
    bgTone: 'bg-orange-50/70 hover:bg-orange-50',
    iconTone: 'bg-orange-500/10 text-orange-600 border border-orange-200/60',
    badgeTone: 'bg-orange-100 text-orange-800',
    borderColor: 'border-orange-200/70 hover:border-orange-300',
  },
  {
    key: 'leave_count',
    label: 'Leave',
    icon: Plane,
    bgTone: 'bg-purple-50/70 hover:bg-purple-50',
    iconTone: 'bg-purple-500/10 text-purple-600 border border-purple-200/60',
    badgeTone: 'bg-purple-100 text-purple-800',
    borderColor: 'border-purple-200/70 hover:border-purple-300',
  },
  {
    key: 'week_off_count',
    label: 'Week Off',
    icon: Palmtree,
    bgTone: 'bg-sky-50/70 hover:bg-sky-50',
    iconTone: 'bg-sky-500/10 text-sky-600 border border-sky-200/60',
    badgeTone: 'bg-sky-100 text-sky-800',
    borderColor: 'border-sky-200/70 hover:border-sky-300',
  },
] as const;

const AttendanceSummaryCards: React.FC<AttendanceSummaryCardsProps> = ({ summary, loading }) => {
  if (loading) {
    return (
      <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-28 animate-pulse rounded-3xl border border-[var(--color-border-soft)] bg-white p-4"
          />
        ))}
      </div>
    );
  }

  const totalHoursFormatted = summary?.total_work_hours
    ? `${summary.total_work_hours.toFixed(1)} hrs`
    : '0 hrs';

  return (
    <div className="space-y-4">
      {/* 6 Metric cards */}
      <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {summaryConfig.map((card) => {
          const Icon = card.icon;
          const value = summary?.[card.key] ?? 0;
          return (
            <div
              key={card.key}
              className={`group relative overflow-hidden rounded-3xl border ${card.borderColor} ${card.bgTone} p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {card.label}
                </span>
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105 ${card.iconTone}`}
                >
                  <Icon className="h-4.5 w-4.5" />
                </div>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-2xl font-bold tracking-tight text-[var(--color-text-primary)]">{value}</span>
                {summary?.total_records && summary.total_records > 0 ? (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${card.badgeTone}`}>
                    {Math.round((value / summary.total_records) * 100)}%
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Aggregate Theme Cards */}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <CommonCard className="!shadow-soft">
          <div className="flex items-center justify-between p-1">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-surface-muted)] text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)]">
                <CalendarCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Total Worked Duration</p>
                <p className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">{totalHoursFormatted}</p>
              </div>
            </div>
            <span className="rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)]">
              Cumulative
            </span>
          </div>
        </CommonCard>

        <CommonCard className="!shadow-soft">
          <div className="flex items-center justify-between p-1">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-surface-muted)] text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)]">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">Total Logs Processed</p>
                <p className="text-xl font-bold tracking-tight text-[var(--color-text-primary)]">{summary?.total_records ?? 0}</p>
              </div>
            </div>
            <span className="rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-brand-gold-dark)] border border-[var(--color-border-soft)]">
              Records
            </span>
          </div>
        </CommonCard>
      </div>
    </div>
  );
};

export default AttendanceSummaryCards;
