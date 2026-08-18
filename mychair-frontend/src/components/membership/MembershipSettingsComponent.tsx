import React, { useState, useEffect } from 'react';
import { Crown, Save, ShieldAlert, Sparkles, CheckCircle2 } from 'lucide-react';
import {
  useGetMembershipSettingsQuery,
  useUpdateMembershipSettingsMutation,
} from '../../redux/slices/customerAnalytics/customerAnalyticsApi';
import { useAppSelector } from '../../redux/hooks';
import { ROLES } from '../../constants';
import { normalizeRole } from '../../config/rbac';
import { showToast, Button } from '../common';

const PREDEFINED_OPTIONS = [
  { label: '1 Month', number: 1, unit: 'Months' },
  { label: '3 Months', number: 3, unit: 'Months' },
  { label: '6 Months', number: 6, unit: 'Months' },
  { label: '1 Year', number: 1, unit: 'Years' },
  { label: '2 Years', number: 2, unit: 'Years' },
  { label: 'Custom', number: 0, unit: 'Months', is_custom: true },
];

export const MembershipSettingsComponent: React.FC = () => {
  const userRole = useAppSelector((state) => state.auth.user?.role);
  const normalizedRole = normalizeRole(userRole);
  const canManage =
    normalizedRole === ROLES.SUPER_ADMIN ||
    normalizedRole === ROLES.SALON_OWNER ||
    normalizedRole === ROLES.SALON_ADMIN ||
    normalizedRole === ROLES.ADMIN ||
    normalizedRole === ROLES.SALON_MANAGER;

  const { data: res, isLoading, refetch } = useGetMembershipSettingsQuery();
  const [updateSettings, { isLoading: isSaving }] = useUpdateMembershipSettingsMutation();

  const settings = res?.data;

  const [selectedLabel, setSelectedLabel] = useState<string>('1 Year');
  const [customNumber, setCustomNumber] = useState<number>(1);
  const [customUnit, setCustomUnit] = useState<string>('Months');

  useEffect(() => {
    if (settings) {
      const match = PREDEFINED_OPTIONS.find(
        (opt) =>
          !opt.is_custom &&
          opt.number === settings.default_duration_number &&
          opt.unit === settings.default_duration_unit
      );

      if (match) {
        setSelectedLabel(match.label);
      } else {
        setSelectedLabel('Custom');
        setCustomNumber(settings.default_duration_number || 1);
        setCustomUnit(settings.default_duration_unit || 'Months');
      }
    }
  }, [settings]);

  const handleSave = async () => {
    if (!canManage) {
      showToast('error', 'You do not have permission to modify membership settings.');
      return;
    }

    let durNum = 1;
    let durUnit = 'Years';
    let durLabel = selectedLabel;

    if (selectedLabel === 'Custom') {
      if (!customNumber || customNumber < 1) {
        showToast('error', 'Please enter a valid positive duration number.');
        return;
      }
      durNum = customNumber;
      durUnit = customUnit;
      const unitSingular = customUnit.endsWith('s') ? customUnit.slice(0, -1) : customUnit;
      durLabel = `${customNumber} ${customNumber === 1 ? unitSingular : customUnit}`;
    } else {
      const opt = PREDEFINED_OPTIONS.find((o) => o.label === selectedLabel);
      if (opt) {
        durNum = opt.number;
        durUnit = opt.unit;
      }
    }

    try {
      await updateSettings({
        default_membership_duration: durLabel,
        default_duration_number: durNum,
        default_duration_unit: durUnit,
      }).unwrap();
      showToast('success', 'Default membership duration updated successfully!');
      refetch();
    } catch (err: any) {
      const errMsg = err?.data?.message || err?.message || 'Failed to update membership settings.';
      showToast('error', errMsg);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl animate-pulse space-y-4">
        <div className="h-6 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-10 w-full bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
        <div className="h-24 w-full bg-slate-100 dark:bg-slate-800/60 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition-all">
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 dark:from-amber-500/20 dark:via-purple-500/20 dark:to-indigo-500/20 border-b border-slate-100 dark:border-slate-800 flex items-start justify-between">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-gradient-to-tr from-amber-500 to-yellow-400 text-white rounded-xl shadow-md shadow-amber-500/20">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Default Membership Duration
            </h3>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Set the salon-wide default validity period for new customer membership enrollments.
            </p>
          </div>
        </div>

        {!canManage && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 text-xs font-semibold">
            <ShieldAlert className="w-4 h-4 text-amber-600" />
            Read Only
          </div>
        )}
      </div>

      <div className="p-6 space-y-6">
        {/* Info Banner */}
        <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-700/60 flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <div className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            When a staff member enrolls a client as a member, this duration will be applied automatically unless custom parameters are specified. All calculations dynamically compute exact expiration timestamps based on calendar rules.
          </div>
        </div>

        {/* Options Grid */}
        <div>
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
            Select Default Duration
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
            {PREDEFINED_OPTIONS.map((option) => {
              const isSelected = selectedLabel === option.label;
              return (
                <button
                  key={option.label}
                  type="button"
                  disabled={!canManage}
                  onClick={() => setSelectedLabel(option.label)}
                  className={`relative p-3.5 rounded-xl border text-center font-medium transition-all ${
                    isSelected
                      ? 'bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 font-bold ring-2 ring-amber-500/20'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  } ${!canManage ? 'opacity-60 cursor-not-allowed' : ''}`}
                >
                  {isSelected && (
                    <CheckCircle2 className="w-4 h-4 text-amber-500 absolute top-2 right-2" />
                  )}
                  <div className="text-sm font-semibold">{option.label}</div>
                  {!option.is_custom && (
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {option.number} {option.unit}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Input Block */}
        {selectedLabel === 'Custom' && (
          <div className="p-4 bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-800/50 rounded-xl space-y-3 animate-fadeIn">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
              Custom Duration Configuration
            </h4>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="w-full sm:w-1/3">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Number
                </label>
                <input
                  type="number"
                  min={1}
                  disabled={!canManage}
                  value={customNumber}
                  onChange={(e) => setCustomNumber(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div className="w-full sm:w-1/3">
                <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                  Unit
                </label>
                <select
                  disabled={!canManage}
                  value={customUnit}
                  onChange={(e) => setCustomUnit(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                >
                  <option value="Days">Days</option>
                  <option value="Months">Months</option>
                  <option value="Years">Years</option>
                </select>
              </div>

              <div className="w-full sm:w-1/3 pt-5 text-xs font-medium text-slate-500 dark:text-slate-400">
                Summary: <strong className="text-slate-800 dark:text-slate-200">{customNumber} {customUnit}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Current Active Configuration Card */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200/60 dark:border-slate-700/40 flex items-center justify-between">
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
              Currently Configured Default
            </span>
            <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
              {settings?.default_membership_duration || '1 Year'} ({settings?.default_duration_number || 1} {settings?.default_duration_unit || 'Years'})
            </span>
          </div>

          {canManage && (
            <Button
              variant="primary"
              size="md"
              isLoading={isSaving}
              loadingText="Saving..."
              icon={<Save className="w-4 h-4" />}
              onClick={handleSave}
            >
              Save Settings
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
