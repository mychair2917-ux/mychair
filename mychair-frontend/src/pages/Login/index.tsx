import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';

import { Button } from '../../components/common';
import { ROLES, ROUTE_PATHS } from '../../constants';
import { setCredentials } from '../../redux/slices/auth/authSlice';
import { useLoginMutation } from '../../redux/slices/auth/authApi';

interface LoginProps {
  isLoggedOut?: boolean;
}

const fieldClassName = [
  'w-full rounded-xl border border-[var(--color-border-strong)]',
  'bg-[var(--color-surface-bg)] py-3.5 pl-11 pr-4 text-sm',
  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]',
  'transition-all duration-200',
  'hover:border-[var(--color-brand-gold-light)]',
  'focus:border-[var(--color-brand-gold)] focus:bg-white focus:outline-none',
  'focus:ring-4 focus:ring-[rgba(197,160,89,0.14)]',
  'autofill:shadow-[inset_0_0_0_1000px_var(--color-surface-bg)]',
].join(' ');

const Login: React.FC<LoginProps> = ({ isLoggedOut }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const [login, { isLoading }] = useLoginMutation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const logoutState = location.state as { loggedOut?: boolean; logoutFailed?: boolean } | null;
  const showLoggedOutMessage = isLoggedOut || Boolean(logoutState?.loggedOut);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      const response = await login({ email, password }).unwrap();

      // Store credentials
      dispatch(
        setCredentials({
          user: {
            id: response.id,
            email: response.email || email,
            role: response.role,
            username: response.username || undefined,
            full_name: response.full_name,
            first_name: response.first_name,
            last_name: response.last_name,
            phone: response.phone,
            alternate_phone: response.alternate_phone,
            avatar: response.avatar,
            employee_id: response.employee_id,
            employee_code: response.employee_code,
            branch_name: response.branch_name,
            branch_id: response.branch_id,
            salon_name: response.salon_name,
            department: response.department,
            designation: response.designation,
            shift: response.shift,
            status: response.status,
            joining_date: response.joining_date,
            last_login: response.last_login,
          },
          token: response.access_token,
          refreshToken: response.refresh_token,
          orgId: response.tenant_id,
          permissions: response.permissions ?? undefined,
        })
      );

      if (response.role === ROLES.SUPER_ADMIN) {
        navigate(`/${ROUTE_PATHS.ADMIN_DASHBOARD}`);
      } else if (response.tenant_id && response.tenant_id !== 'system') {
        navigate(`/orgs/${response.tenant_id}/${ROUTE_PATHS.DASHBOARD}`);
      } else {
        navigate(`/${ROUTE_PATHS.ROOT}`);
      }
    } catch (err: unknown) {
      const apiErr = err as { data?: { message?: string; detail?: string } };
      setErrorMsg(
        apiErr?.data?.message || apiErr?.data?.detail || 'Invalid email or password. Please try again.'
      );
    }
  };

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-[#f7f2ea]">
      {/*
        Full landscape image centered; a blurred copy fills top/bottom
        so there are no flat beige gaps.
      */}
      <aside className="relative hidden min-h-screen w-[62%] overflow-hidden bg-[#ebe4d6] lg:block xl:w-[65%]">
        <img
          src="/images/login-salon-hero.png"
          alt=""
          aria-hidden="true"
          className="absolute inset-0 h-full w-full scale-110 object-cover object-center blur-2xl"
        />
        <img
          src="/images/login-salon-hero.png"
          alt="MyChair — Smart Salon Management"
          className="absolute inset-0 h-full w-full object-contain object-center"
        />
      </aside>

      {/* Right form column */}
      <main className="flex w-full flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:min-w-[360px] lg:px-10 xl:px-14">
        <div className="w-full max-w-[400px]">
          {/* Mobile brand visual — full image, no crop */}
          <div className="mb-8 overflow-hidden rounded-2xl bg-[#ebe4d6] shadow-soft lg:hidden">
            <img
              src="/images/login-salon-hero.png"
              alt="MyChair — Smart Salon Management"
              className="h-auto w-full object-contain"
            />
          </div>

          <div className="rounded-[20px] border border-[var(--color-border-soft)] bg-white px-7 py-8 shadow-[0_12px_40px_rgba(31,31,30,0.06)] sm:px-9 sm:py-10">
            {/* Brand + welcome — single header block */}
            <div className="mb-8 flex flex-col items-center text-center">
              <img
                src="/images/logo.png"
                alt="MyChair"
                className="mb-5 h-12 w-12 rounded-2xl object-cover shadow-md shadow-[rgba(197,160,89,0.28)]"
              />
              <h1 className="text-[1.625rem] font-semibold leading-tight tracking-[-0.03em] text-[var(--color-text-primary)]">
                Welcome back
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
                Sign in to continue to MyChair
              </p>
              <p className="mt-4 max-w-[18rem] text-xs leading-relaxed text-[var(--color-text-tertiary)]">
                Manage appointments, staff, clients, and growth—all in one place.
              </p>
            </div>

            {showLoggedOutMessage && (
              <div
                role="status"
                className={`mb-5 rounded-xl px-4 py-3 text-center text-sm ${
                  logoutState?.logoutFailed
                    ? 'border border-amber-200/80 bg-amber-50 text-amber-800'
                    : 'border border-[rgba(197,160,89,0.25)] bg-[var(--color-surface-muted)] text-[var(--color-brand-gold-dark)]'
                }`}
              >
                {logoutState?.logoutFailed
                  ? 'You have been logged out locally. Server session may already be expired.'
                  : 'You have been logged out.'}
              </div>
            )}

            {errorMsg && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-center text-sm text-red-700"
              >
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleLogin} className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label
                  htmlFor="login-email"
                  className="text-sm font-medium tracking-[-0.01em] text-[var(--color-text-primary)]"
                >
                  Email
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
                    aria-hidden="true"
                  />
                  <input
                    id="login-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="mychair2918@gmail.com"
                    className={fieldClassName}
                    required
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label
                  htmlFor="login-password"
                  className="text-sm font-medium tracking-[-0.01em] text-[var(--color-text-primary)]"
                >
                  Password
                </label>
                <div className="relative">
                  <Lock
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
                    aria-hidden="true"
                  />
                  <input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className={`${fieldClassName} pr-11`}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors duration-200 hover:bg-[rgba(197,160,89,0.1)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-gold)] focus-visible:ring-offset-2"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                className="mt-2 h-12 rounded-xl text-[0.95rem] shadow-md shadow-[rgba(197,160,89,0.25)]"
                isLoading={isLoading}
                loadingText="Signing in..."
              >
                Sign In
              </Button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Login;
