import React, { useMemo } from 'react';

import { useAppSelector } from '../../redux/hooks';
import { normalizeRole } from '../../config/rbac';
import { ROLES } from '../../constants';
import OwnerSalonEarnings from './OwnerSalonEarnings';
import StaffMyEarnings from './StaffMyEarnings';

/**
 * Role-based My Earnings entry:
 * - Salon Owner → enhanced salon-wide earnings overview
 * - Manager / Staff / Admin / others → existing personal My Earnings (unchanged)
 */
const MyEarningsPage: React.FC = () => {
  const user = useAppSelector((state) => state.auth.user);
  const isSalonOwner = useMemo(
    () => normalizeRole(user?.role) === ROLES.SALON_OWNER,
    [user?.role]
  );

  if (isSalonOwner) {
    return <OwnerSalonEarnings />;
  }

  return <StaffMyEarnings />;
};

export default MyEarningsPage;
