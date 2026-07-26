import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

import { useAppSelector } from '../../redux/hooks';
import { updateAuthUser } from '../../redux/slices/auth/authSlice';
import { useGetProfileQuery } from '../../redux/slices/profile/profileApi';

/**
 * Keeps auth user display fields in sync with /profile so greetings,
 * sidebar, and header always show the person's full name.
 */
const AuthProfileSync: React.FC = () => {
  const dispatch = useDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const { data } = useGetProfileQuery(undefined, { skip: !token });

  useEffect(() => {
    const profile = data?.data;
    if (!profile) return;

    dispatch(
      updateAuthUser({
        id: profile.id,
        email: profile.email,
        role: profile.role,
        full_name: profile.full_name,
        first_name: profile.first_name ?? undefined,
        last_name: profile.last_name ?? undefined,
        phone: profile.phone ?? undefined,
        alternate_phone: profile.alternate_phone ?? undefined,
        avatar: profile.avatar ?? null,
        employee_id: profile.employee_id ?? undefined,
        employee_code: profile.employee_code ?? undefined,
        branch_name: profile.branch_name ?? undefined,
        branch_id: profile.branch_id ?? undefined,
        salon_name: profile.salon_name ?? undefined,
        department: profile.department ?? undefined,
        designation: profile.designation ?? undefined,
        shift: profile.shift ?? undefined,
        status: profile.status,
        joining_date: profile.joining_date ?? null,
        last_login: profile.last_login ?? null,
      })
    );
  }, [data?.data, dispatch]);

  return null;
};

export default AuthProfileSync;
