import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { setCredentials } from '../../redux/slices/auth/authSlice';

interface LoginProps {
  isLoggedOut?: boolean;
}

const Login: React.FC<LoginProps> = ({ isLoggedOut }) => {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Mock login logic
    dispatch(
      setCredentials({
        user: { id: '1', name: 'Demo User', email: 'demo@example.com', role: 'admin' },
        token: 'mock-jwt-token-12345',
        refreshToken: 'mock-refresh-token',
        orgId: 'org-1',
      })
    );
    navigate('/orgs/org-1/dashboard');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Welcome Back</h1>
        {isLoggedOut && (
          <div className="mb-4 p-3 bg-blue-50 text-blue-700 rounded text-sm text-center">
            You have been logged out.
          </div>
        )}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              defaultValue="demo@example.com"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              defaultValue="password123"
              className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <button
            type="submit"
            className="w-full mt-4 bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition-colors font-medium"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
