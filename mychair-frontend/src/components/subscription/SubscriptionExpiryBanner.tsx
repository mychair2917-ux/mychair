import { AlertTriangle } from 'lucide-react';

import { useGetSubscriptionStatusQuery } from '../../redux/slices/subscriptions/subscriptionsApi';
import { isSuperAdmin } from '../../config/rbac';
import { useAppSelector } from '../../redux/hooks';

const SubscriptionExpiryBanner = () => {
  const user = useAppSelector((state) => state.auth.user);
  const { data: status } = useGetSubscriptionStatusQuery(undefined, {
    skip: !user || isSuperAdmin(user.role),
    pollingInterval: 300000,
  });

  if (!status?.show_reminder_banner || !status.reminder_message) {
    return null;
  }

  return (
    <div className="mx-4 mt-4 md:mx-8 md:mt-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 shadow-sm">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-sm font-medium">{status.reminder_message}</p>
      </div>
    </div>
  );
};

export default SubscriptionExpiryBanner;
