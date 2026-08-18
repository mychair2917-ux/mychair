import React, { useState, useMemo } from 'react';
import { Crown, Calendar, Sparkles, ShieldCheck, X } from 'lucide-react';
import { Customer } from '../../redux/slices/customerAnalytics/Types';
import {
  useAddCustomerMembershipMutation,
  useRenewCustomerMembershipMutation,
} from '../../redux/slices/customerAnalytics/customerAnalyticsApi';
import { showToast } from '../../components/common';

interface AddRenewMembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  mode: 'add' | 'renew';
}

export const AddRenewMembershipModal: React.FC<AddRenewMembershipModalProps> = ({
  isOpen,
  onClose,
  customer,
  mode,
}) => {
  const [durationYears, setDurationYears] = useState<number>(1);
  const [membershipType, setMembershipType] = useState<string>(
    customer.membership_type || 'Standard Membership'
  );

  const [addMembership, { isLoading: isAdding }] = useAddCustomerMembershipMutation();
  const [renewMembership, { isLoading: isRenewing }] = useRenewCustomerMembershipMutation();

  const isSubmitting = isAdding || isRenewing;

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

    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + durationYears);
    endDate.setDate(endDate.getDate() - 1);

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
  }, [mode, customer.membership_end_date, durationYears]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (mode === 'add') {
        const res = await addMembership({
          customerId: customer.id,
          duration_years: durationYears,
          membership_type: membershipType.trim() || 'Standard Membership',
        }).unwrap();

        showToast('success', res.message || 'Membership enrolled successfully!');
      } else {
        const res = await renewMembership({
          customerId: customer.id,
          duration_years: durationYears,
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
                  Enrolling this client creates a <strong>1-year default membership</strong> validity period. Members enjoy special pricing & reward rates across services.
                </>
              ) : (
                <>
                  Renewing will append <strong>{durationYears} year(s)</strong> to the client's current membership timeline without losing remaining active days.
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
            <div className="grid grid-cols-3 gap-2.5">
              {[1, 2, 3].map((years) => (
                <button
                  type="button"
                  key={years}
                  onClick={() => setDurationYears(years)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-semibold border text-center transition-all ${
                    durationYears === years
                      ? 'bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-500/25 ring-2 ring-amber-500/20'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  {years} {years === 1 ? 'Year (Default)' : 'Years'}
                </button>
              ))}
            </div>
          </div>

          {/* Date Calculation Card */}
          <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-400" /> Dynamic Timeline Preview
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold tracking-wide uppercase">
                {durationYears * 12} Months Valid
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
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 rounded-xl shadow-lg shadow-amber-500/25 transition disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              {isSubmitting
                ? 'Processing...'
                : mode === 'add'
                ? 'Confirm Enrollment'
                : 'Confirm Renewal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
