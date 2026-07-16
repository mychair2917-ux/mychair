import { CreditCard, Mail, ShieldAlert } from 'lucide-react';

import { isSuperAdmin, normalizeRole } from '../../config/rbac';
import { ROLES } from '../../constants';
import { useGetMySubscriptionQuery } from '../../redux/slices/subscriptions/subscriptionsApi';
import { useAppSelector } from '../../redux/hooks';
import { formatDateDMY } from '../../utils/utilities';

const SubscriptionExpired = () => {
  const user = useAppSelector((state) => state.auth.user);
  const role = normalizeRole(user?.role);
  const isOwner = role === ROLES.SALON_OWNER;

  const { data: subscription } = useGetMySubscriptionQuery(undefined, {
    skip: !isOwner,
  });

  if (isSuperAdmin(user?.role)) {
    return null;
  }

  if (isOwner) {
    return (
      <div className="min-h-screen bg-[var(--color-surface-bg)] px-4 py-10 md:px-8">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[var(--color-border-soft)] bg-white p-8 shadow-soft">
          <div className="mb-6 flex items-center gap-3 text-red-600">
            <ShieldAlert className="h-8 w-8" />
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">
              Your subscription has expired.
            </h1>
          </div>

          <p className="mb-8 text-[var(--color-text-secondary)]">
            Please contact your MyChair administrator to renew your subscription. You cannot extend
            or modify your subscription from this page.
          </p>

          {subscription && (
            <div className="mb-8 grid gap-4 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] p-5 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Current Plan</p>
                <p className="mt-1 font-semibold">{subscription.plan_label}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Status</p>
                <p className="mt-1 font-semibold text-red-600">{subscription.status}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">Start Date</p>
                <p className="mt-1 font-semibold">{formatDateDMY(subscription.start_date)}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">End Date</p>
                <p className="mt-1 font-semibold">{formatDateDMY(subscription.end_date)}</p>
              </div>
            </div>
          )}

          <section className="mb-8">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <CreditCard className="h-5 w-5 text-[var(--color-brand-gold)]" />
              Available Plans
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {(subscription?.available_plans ?? []).map((plan) => (
                <div
                  key={plan.value}
                  className="rounded-xl border border-[var(--color-border-soft)] px-4 py-3 text-sm font-medium"
                >
                  {plan.label}
                </div>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <h2 className="mb-4 text-lg font-semibold">Billing History</h2>
            {subscription?.billing_history?.length ? (
              <div className="space-y-3">
                {subscription.billing_history.map((item, index) => (
                  <div
                    key={`${item.date}-${index}`}
                    className="rounded-xl border border-[var(--color-border-soft)] px-4 py-3 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">{item.plan_label}</span>
                      <span className="text-[var(--color-text-secondary)]">
                        {formatDateDMY(item.date)}
                      </span>
                    </div>
                    <p className="mt-1 text-[var(--color-text-secondary)]">{item.notes || item.action}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--color-text-secondary)]">No billing history available.</p>
            )}
          </section>

          <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] p-5">
            <h3 className="mb-2 flex items-center gap-2 font-semibold">
              <Mail className="h-4 w-4 text-[var(--color-brand-gold)]" />
              Contact Support
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)]">
              Email <a href="mailto:support@mychair.com" className="text-[var(--color-brand-gold)] underline">support@mychair.com</a> or contact your platform administrator to renew your subscription.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-surface-bg)] px-4">
      <div className="max-w-lg rounded-2xl border border-[var(--color-border-soft)] bg-white p-8 text-center shadow-soft">
        <ShieldAlert className="mx-auto mb-4 h-12 w-12 text-red-500" />
        <h1 className="mb-3 text-2xl font-bold text-[var(--color-text-primary)]">
          Salon subscription has expired.
        </h1>
        <p className="text-[var(--color-text-secondary)]">
          Please contact the salon owner.
        </p>
      </div>
    </div>
  );
};

export default SubscriptionExpired;
