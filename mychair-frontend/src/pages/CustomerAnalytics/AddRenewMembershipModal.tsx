import React, { useState, useMemo, useEffect } from 'react';
import { Crown, Calendar, Sparkles, ShieldCheck, X } from 'lucide-react';
import { Customer } from '../../redux/slices/customerAnalytics/Types';
import {
  useAddCustomerMembershipMutation,
  useRenewCustomerMembershipMutation,
  useGetMembershipSettingsQuery,
} from '../../redux/slices/customerAnalytics/customerAnalyticsApi';
import { showToast, Button } from '../../components/common';

interface AddRenewMembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  mode: 'add' | 'renew';
}

const PRESET_OPTIONS = [
  { label: '1 Month', number: 1, unit: 'Months' },
  { label: '3 Months', number: 3, unit: 'Months' },
  { label: '6 Months', number: 6, unit: 'Months' },
  { label: '1 Year', number: 1, unit: 'Years' },
  { label: '2 Years', number: 2, unit: 'Years' },
  { label: 'Custom', number: 0, unit: 'Months', is_custom: true },
];

function calculateExpiryDate(startDate: Date, num: number, unit: string): Date {
  const result = new Date(startDate);
  const normalizedUnit = unit.toLowerCase();

  if (normalizedUnit.includes('day')) {
    result.setDate(result.getDate() + num);
  } else if (normalizedUnit.includes('month')) {
    result.setMonth(result.getMonth() + num);
  } else if (normalizedUnit.includes('year')) {
    result.setFullYear(result.getFullYear() + num);
  } else {
    result.setFullYear(result.getFullYear() + num);
  }

  // Subtract 1 day for end of cycle (inclusive date calculation)
  result.setDate(result.getDate() - 1);
  return result;
}

export const AddRenewMembershipModal: React.FC<AddRenewMembershipModalProps> = ({
  isOpen,
  onClose,
  customer,
  mode,
}) => {
  const { data: settingsRes } = useGetMembershipSettingsQuery(undefined, { skip: !isOpen });
  const settings = settingsRes?.data;

  const [selectedPreset, setSelectedPreset] = useState<string>('1 Year');
  const [durationNum, setDurationNum] = useState<number>(1);
  const [durationUnit, setDurationUnit] = useState<string>('Years');
  const [membershipType, setMembershipType] = useState<string>(
    customer.membership_type || 'Standard Membership'
  );

  const [addMembership, { isLoading: isAdding }] = useAddCustomerMembershipMutation();
  const [renewMembership, { isLoading: isRenewing }] = useRenewCustomerMembershipMutation();

  const isSubmitting = isAdding || isRenewing;

  // Initialize duration from salon default settings when modal opens
  useEffect(() => {
    if (isOpen && settings) {
      const defaultNum = settings.default_duration_number || 1;
      const defaultUnit = settings.default_duration_unit || 'Years';
      const match = PRESET_OPTIONS.find(
        (p) => !p.is_custom && p.number === defaultNum && p.unit === defaultUnit
      );
      if (match) {
        setSelectedPreset(match.label);
        setDurationNum(match.number);
        setDurationUnit(match.unit);
      } else {
        setSelectedPreset('Custom');
        setDurationNum(defaultNum);
        setDurationUnit(defaultUnit);
      }
    }
  }, [isOpen, settings]);

  const handlePresetSelect = (preset: (typeof PRESET_OPTIONS)[0]) => {
    setSelectedPreset(preset.label);
    if (!preset.is_custom) {
      setDurationNum(preset.number);
      setDurationUnit(preset.unit);
    }
  };

  // Calculate dynamic start and end dates for visual preview
  const datePreview = useMemo(() => {
    const now = new Date();
    let startDate = now;

    if (mode === 'renew' && customer.membership_end_date) {
      const currentEnd = new Date(customer.membership_end_date);
      if (currentEnd > now) {
        // Active membership: renew starting from current end date + 1 day
        startDate = new Date(currentEnd.getTime() + 24 * 60 * 60 * 1000);
      }
    }

    const endDate = calculateExpiryDate(startDate, durationNum, durationUnit);

    const formatDate = (d: Date) =>
      d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });

    return {
      startFormatted: formatDate(startDate),
      endFormatted: formatDate(endDate),
    };
  }, [mode, customer.membership_end_date, durationNum, durationUnit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (durationNum < 1) {
      showToast('error', 'Please select or enter a valid duration greater than 0.');
      return;
    }

    try {
      if (mode === 'add') {
        const res = await addMembership({
          customerId: customer.id,
          duration_number: durationNum,
          duration_unit: durationUnit,
          membership_type: membershipType.trim() || 'Standard Membership',
        }).unwrap();

        showToast('success', res.message || 'Membership enrolled successfully!');
      } else {
        const res = await renewMembership({
          customerId: customer.id,
          duration_number: durationNum,
          duration_unit: durationUnit,
          membership_type: membershipType.trim() || undefined,
        }).unwrap();

        showToast('success', res.message || 'Membership renewed successfully!');
      }
      onClose();
    } catch (err: any) {
      const errMsg = err?.data?.message || err?.message || 'Failed to update membership.';
      showToast('error', errMsg);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-lg overflow-hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl transition-all">
        {/* Header */}
        <div className="relative px-6 pt-6 pb-4 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 dark:from-amber-500/20 dark:via-purple-500/20 dark:to-indigo-500/20 border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-tr from-amber-500 to-yellow-400 text-white rounded-xl shadow-md shadow-amber-500/20">
              <Crown className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                {mode === 'add' ? 'Enroll Client Membership' : 'Renew Client Membership'}
              </h3>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                {customer.full_name} ({customer.phone})
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Info Banner */}
          <div className="p-3.5 flex items-start gap-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs leading-relaxed">
            <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div>
              {mode === 'add' ? (
                <>
                  Enrolling this client applies a <strong>{durationNum} {durationUnit}</strong> membership validity period. Members enjoy special pricing & reward rates across services.
                </>
              ) : (
                <>
                  Renewing will append <strong>{durationNum} {durationUnit}</strong> to the client's current membership timeline without losing remaining active days.
                </>
              )}
            </div>
          </div>

          {/* Membership Type Field */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Membership Type / Plan Name
            </label>
            <input
              type="text"
              value={membershipType}
              onChange={(e) => setMembershipType(e.target.value)}
              placeholder="e.g. Standard Membership, Premium VIP"
              className="w-full px-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 text-slate-900 dark:text-white placeholder-slate-400 transition"
              required
            />
          </div>

          {/* Duration Selection */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
              Membership Duration
            </label>
            <div className="grid grid-cols-3 gap-2">
              {PRESET_OPTIONS.map((preset) => {
                const isSelected = selectedPreset === preset.label;
                return (
                  <button
                    type="button"
                    key={preset.label}
                    onClick={() => handlePresetSelect(preset)}
                    className={`relative py-2 px-2.5 rounded-xl text-xs font-semibold border text-center transition-all ${
                      isSelected
                        ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25 ring-2 ring-amber-500/20'
                        : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Duration Inputs */}
          {selectedPreset === 'Custom' && (
            <div className="p-3.5 bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl space-y-2 animate-fadeIn">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                Custom Duration Details
              </label>
              <div className="flex items-center gap-3">
                <div className="w-1/2">
                  <label className="block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Number
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={durationNum}
                    onChange={(e) => setDurationNum(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  />
                </div>
                <div className="w-1/2">
                  <label className="block text-[10px] uppercase font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Unit
                  </label>
                  <select
                    value={durationUnit}
                    onChange={(e) => setDurationUnit(e.target.value)}
                    className="w-full px-3 py-1.5 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white"
                  >
                    <option value="Days">Days</option>
                    <option value="Months">Months</option>
                    <option value="Years">Years</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Date Calculation Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Dynamic Timeline Preview
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold tracking-wide uppercase">
                {durationNum} {durationUnit} Valid
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
              <div>
                <span className="block text-[11px] text-slate-400 font-medium uppercase">Start Date</span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {datePreview.startFormatted}
                </span>
              </div>
              <div>
                <span className="block text-[11px] text-slate-400 font-medium uppercase">Expiry Date</span>
                <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                  {datePreview.endFormatted}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="secondary"
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              isLoading={isSubmitting}
              loadingText="Processing..."
              icon={<ShieldCheck className="w-4 h-4" />}
            >
              {mode === 'add' ? 'Confirm Enrollment' : 'Confirm Renewal'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
