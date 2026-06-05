import { useNavigate } from 'react-router-dom';

import { showToast } from '../components/common/Toast/toastService';
import { useAppDispatch, useAppSelector } from '../redux/hooks';
import { useLogoutUserMutation } from '../redux/slices/auth/authApi';
import { logout } from '../redux/slices/auth/authSlice';
import { getPostLogoutPath } from '../redux/slices/auth/authSession';
import { baseApi } from '../redux/slices/api/baseApi';
import { getApiErrorMessage } from '../utils/apiErrors';

export const useAuthActions = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const role = useAppSelector((state) => state.auth.user?.role);
  const refreshToken = useAppSelector((state) => state.auth.refreshToken);
  const [triggerLogout, { isLoading: isLoggingOut }] = useLogoutUserMutation();

  const logoutUser = async () => {
    let logoutFailed = false;

    if (refreshToken) {
      try {
        await triggerLogout({ refresh_token: refreshToken }).unwrap();
      } catch (error) {
        logoutFailed = true;
        showToast('warning', getApiErrorMessage(error, 'Logged out locally. Server session may have already expired.'));
      }
    }

    dispatch(logout());
    dispatch(baseApi.util.resetApiState());
    navigate(getPostLogoutPath(role), {
      replace: true,
      state: { loggedOut: true, logoutFailed },
    });
  };

  return {
    isLoggingOut,
    logoutUser,
  };
};
