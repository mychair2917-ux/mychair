import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ROLES, ROUTE_PATHS } from '../../constants';
import { setCredentials } from '../../redux/slices/auth/authSlice';
import { useLoginMutation } from '../../redux/slices/auth/authApi';

interface LoginProps {
  isLoggedOut?: boolean;
}

const Login: React.FC<LoginProps> = ({ isLoggedOut }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [login, { isLoading }] = useLoginMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      const response = await login({ email, password }).unwrap();
      
      // Store credentials
      dispatch(
        setCredentials({
          user: {
            email,
            role: response.role,
            username: email.split('@')[0],
          },
          token: response.access_token,
          refreshToken: response.refresh_token,
          orgId: response.tenant_id,
        })
      );
      
      if (response.role === ROLES.SUPER_ADMIN) {
        navigate(`/${ROUTE_PATHS.INVITE}`);
      } else {
        navigate(`/orgs/${response.tenant_id}/${ROUTE_PATHS.DASHBOARD}`);
      }
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string; detail?: string } };
      setErrorMsg(
        apiErr?.data?.message || apiErr?.data?.detail || 'Invalid email or password. Please try again.'
      );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="flex justify-center mb-6">
           <h1 className="text-3xl font-bold text-gray-900">Salon ERP</h1>
        </div>
        <h2 className="text-xl font-semibold text-center mb-6 text-gray-700">Super Admin Login</h2>
        
        {isLoggedOut && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded text-sm text-center">
            You have been logged out.
          </div>
        )}

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded text-sm text-center">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mychair2918@gmail.com"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full mt-4 text-white py-2 rounded transition-colors font-medium ${
              isLoading ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
