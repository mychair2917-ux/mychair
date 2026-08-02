import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  XCircle,
  ArrowRight,
} from 'lucide-react';
import { Button } from '../../components/common';
import { ROUTE_PATHS } from '../../constants';
import {
  useValidateResetTokenQuery,
  useResetPasswordSubmitMutation,
} from '../../redux/slices/auth/authApi';
import { hashPassword } from '../../utils/crypto';

const fieldClassName = [
  'w-full rounded-xl border border-[var(--color-border-strong)]',
  'bg-[var(--color-surface-bg)] py-3.5 pl-11 pr-11 text-sm',
  'text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]',
  'transition-all duration-200',
  'hover:border-[var(--color-brand-gold-light)]',
  'focus:border-[var(--color-brand-gold)] focus:bg-white focus:outline-none',
  'focus:ring-4 focus:ring-[rgba(197,160,89,0.14)]',
  'autofill:shadow-[inset_0_0_0_1000px_var(--color-surface-bg)]',
].join(' ');

const AuthShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-screen overflow-x-hidden bg-[#f7f2ea]">
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

    <main className="flex w-full flex-1 items-center justify-center px-5 py-10 sm:px-8 lg:min-w-[360px] lg:px-10 xl:px-14">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 overflow-hidden rounded-2xl bg-[#ebe4d6] shadow-soft lg:hidden">
          <img
            src="/images/login-salon-hero.png"
            alt="MyChair — Smart Salon Management"
            className="h-auto w-full object-contain"
          />
        </div>
        {children}
      </div>
    </main>
  </div>
);

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const rawUrlToken = searchParams.get('token') || '';
  const token = decodeURIComponent(rawUrlToken).trim();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState('');
  const [redirectCountdown, setRedirectCountdown] = useState(3);

  const { data: tokenStatus, isLoading: isValidatingToken, isFetching, isError: isTokenValidationError } =
    useValidateResetTokenQuery(token, {
      skip: !token,
      refetchOnMountOrArgChange: true,
    });

  const isCheckingToken = isValidatingToken || isFetching;

  const [resetPasswordSubmit, { isLoading: isSubmitting }] = useResetPasswordSubmitMutation();

  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^A-Za-z0-9]/.test(password);
  const passwordsMatch = password.length > 0 && password === confirmPassword;

  const passedCriteriaCount = [
    hasMinLength,
    hasUppercase,
    hasLowercase,
    hasNumber,
    hasSpecial,
  ].filter(Boolean).length;

  const isFormValid = passedCriteriaCount === 5 && passwordsMatch;

  const getStrengthLabel = () => {
    if (passedCriteriaCount <= 2) return { label: 'Weak', color: 'bg-red-500', text: 'text-red-600' };
    if (passedCriteriaCount === 3 || passedCriteriaCount === 4)
      return { label: 'Fair', color: 'bg-amber-500', text: 'text-amber-700' };
    return { label: 'Strong', color: 'bg-emerald-500', text: 'text-emerald-700' };
  };

  const strength = getStrengthLabel();

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isSuccess && redirectCountdown > 0) {
      timer = setTimeout(() => {
        setRedirectCountdown((prev) => prev - 1);
      }, 1000);
    } else if (isSuccess && redirectCountdown === 0) {
      navigate(`/${ROUTE_PATHS.LOGIN}`, { replace: true });
    }
    return () => clearTimeout(timer);
  }, [isSuccess, redirectCountdown, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    if (!isFormValid) return;

    try {
      const hashedPassword = await hashPassword(password);
      const hashedConfirmPassword = await hashPassword(confirmPassword);
      await resetPasswordSubmit({
        token,
        password: hashedPassword,
        confirmPassword: hashedConfirmPassword,
      }).unwrap();
      setIsSuccess(true);
    } catch (err: any) {
      const msg = err?.data?.detail || err?.data?.message || 'Failed to reset password. Please try again.';
      setServerError(msg);
    }
  };

  const isInvalidToken = !token || (!isCheckingToken && (isTokenValidationError || !tokenStatus?.valid));

  return (
    <AuthShell>
      <div className="rounded-[20px] border border-[var(--color-border-soft)] bg-white px-7 py-8 shadow-[0_12px_40px_rgba(31,31,30,0.06)] sm:px-9 sm:py-10">
        <div className="mb-8 flex flex-col items-center text-center">
          <img
            src="/images/logo.png"
            alt="MyChair"
            className="mb-5 h-12 w-12 rounded-2xl object-cover shadow-md shadow-[rgba(197,160,89,0.28)]"
          />
          <h1 className="text-[1.625rem] font-semibold leading-tight tracking-[-0.03em] text-[var(--color-text-primary)]">
            Reset Password
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            Create a new strong password for your MyChair account
          </p>
        </div>

        {isCheckingToken ? (
          <div className="text-center py-10 space-y-3">
            <p className="text-sm text-[var(--color-text-secondary)]">Validating password reset link...</p>
          </div>
        ) : isInvalidToken ? (
          <div className="text-center space-y-5 py-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-red-50 text-red-600 border border-red-100">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Invalid or Expired Link</h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              This password reset link is invalid, incomplete, or has expired after 15 minutes.
            </p>
            <div className="pt-2">
              <Link to={`/${ROUTE_PATHS.FORGOT_PASSWORD}`}>
                <Button variant="primary" size="lg" fullWidth className="h-12 rounded-xl">
                  Request New Link
                </Button>
              </Link>
            </div>
          </div>
        ) : isSuccess ? (
          <div className="text-center space-y-5 py-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Password Reset Successful</h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              Your password has been reset. All previous sessions have been invalidated.
            </p>
            <div className="rounded-xl bg-[var(--color-surface-bg)] border border-[var(--color-border-soft)] p-3 text-xs text-[var(--color-text-tertiary)]">
              Redirecting to Sign In in <strong className="font-bold text-[var(--color-brand-gold-dark)]">{redirectCountdown}s</strong>...
            </div>
            <div className="pt-1">
              <Button
                type="button"
                variant="primary"
                size="lg"
                fullWidth
                onClick={() => navigate(`/${ROUTE_PATHS.LOGIN}`, { replace: true })}
                className="h-12 rounded-xl"
              >
                Sign In Now
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5" noValidate>
            {serverError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-700 flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-500 mt-0.5" />
                <span>{serverError}</span>
              </div>
            )}

            {/* New Password */}
            <div className="flex flex-col gap-2">
              <label htmlFor="reset-password" className="text-sm font-medium tracking-[-0.01em] text-[var(--color-text-primary)]">
                New Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
                  aria-hidden="true"
                />
                <input
                  id="reset-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter new password"
                  className={fieldClassName}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[rgba(197,160,89,0.1)] hover:text-[var(--color-text-primary)]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Password Strength Indicator */}
            {password.length > 0 && (
              <div className="space-y-1.5 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] p-3">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-[var(--color-text-tertiary)]">Password Strength</span>
                  <span className={`font-semibold ${strength.text}`}>{strength.label}</span>
                </div>
                <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${strength.color}`}
                    style={{ width: `${(passedCriteriaCount / 5) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Confirm Password */}
            <div className="flex flex-col gap-2">
              <label htmlFor="confirm-new-password" className="text-sm font-medium tracking-[-0.01em] text-[var(--color-text-primary)]">
                Confirm New Password
              </label>
              <div className="relative">
                <ShieldCheck
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
                  aria-hidden="true"
                />
                <input
                  id="confirm-new-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className={fieldClassName}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--color-text-tertiary)] transition-colors hover:bg-[rgba(197,160,89,0.1)] hover:text-[var(--color-text-primary)]"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Requirements Checklist */}
            <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] p-3.5 space-y-2">
              <p className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">
                Password Requirements
              </p>
              <ul className="space-y-1 text-xs">
                <li className={`flex items-center ${hasMinLength ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {hasMinLength ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 mr-1.5 text-slate-400" />}
                  At least 8 characters
                </li>
                <li className={`flex items-center ${hasUppercase ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {hasUppercase ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 mr-1.5 text-slate-400" />}
                  At least 1 uppercase letter (A-Z)
                </li>
                <li className={`flex items-center ${hasLowercase ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {hasLowercase ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 mr-1.5 text-slate-400" />}
                  At least 1 lowercase letter (a-z)
                </li>
                <li className={`flex items-center ${hasNumber ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {hasNumber ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 mr-1.5 text-slate-400" />}
                  At least 1 number (0-9)
                </li>
                <li className={`flex items-center ${hasSpecial ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {hasSpecial ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 mr-1.5 text-slate-400" />}
                  At least 1 special character (!@#$%^&*)
                </li>
                <li className={`flex items-center ${passwordsMatch ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {passwordsMatch ? <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-600" /> : <XCircle className="w-3.5 h-3.5 mr-1.5 text-slate-400" />}
                  Passwords match
                </li>
              </ul>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              disabled={!isFormValid || isSubmitting}
              isLoading={isSubmitting}
              loadingText="Resetting..."
              className="mt-2 h-12 rounded-xl text-[0.95rem] shadow-md shadow-[rgba(197,160,89,0.25)]"
            >
              Reset Password
            </Button>
          </form>
        )}
      </div>
    </AuthShell>
  );
};

export default ResetPassword;
