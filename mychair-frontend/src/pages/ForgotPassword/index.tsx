import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '../../components/common';
import { useForgotPasswordLinkMutation } from '../../redux/slices/auth/authApi';
import { ROUTE_PATHS } from '../../constants';

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

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState('');

  const [forgotPasswordLink, { isLoading }] = useForgotPasswordLinkMutation();

  const validateEmail = (val: string) => {
    if (!val.trim()) {
      return 'Email address is required.';
    }
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!regex.test(val)) {
      return 'Please enter a valid email address.';
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    const error = validateEmail(email);
    if (error) {
      setEmailError(error);
      return;
    }

    try {
      await forgotPasswordLink({ email: email.trim() }).unwrap();
      setSubmitted(true);
    } catch (err: any) {
      if (err?.status === 429) {
        setServerError(err?.data?.detail || 'Too many password reset requests. Please try again later.');
      } else {
        setSubmitted(true);
      }
    }
  };

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
            Forgot password?
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            Enter your email address and we&apos;ll send you a password reset link.
          </p>
        </div>

        {submitted ? (
          <div className="text-center space-y-5 py-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[rgba(197,160,89,0.12)] text-[var(--color-brand-gold-dark)]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h3 className="text-base font-semibold text-[var(--color-text-primary)]">Check your inbox</h3>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              If an account exists for <strong className="font-medium text-[var(--color-text-primary)]">{email}</strong>, we have sent instructions to reset your password.
            </p>
            <p className="text-[11px] text-[var(--color-text-tertiary)]">
              The link expires in <strong className="font-semibold text-[var(--color-text-secondary)]">15 minutes</strong>. Check your spam folder if you don&apos;t see it.
            </p>

            <div className="pt-4 border-t border-[var(--color-border-soft)]">
              <Link
                to={`/${ROUTE_PATHS.LOGIN}`}
                className="inline-flex items-center text-xs font-semibold text-[var(--color-brand-gold-dark)] hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Back to Sign In
              </Link>
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

            <div className="flex flex-col gap-2">
              <label htmlFor="forgot-email" className="text-sm font-medium tracking-[-0.01em] text-[var(--color-text-primary)]">
                Email address
              </label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
                  aria-hidden="true"
                />
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (emailError) setEmailError('');
                  }}
                  placeholder="name@salon.com"
                  className={`${fieldClassName} ${emailError ? 'border-red-500 focus:border-red-500 focus:ring-red-200' : ''}`}
                />
              </div>
              {emailError && <p className="text-xs text-red-600">{emailError}</p>}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              fullWidth
              className="mt-2 h-12 rounded-xl text-[0.95rem] shadow-md shadow-[rgba(197,160,89,0.25)]"
              isLoading={isLoading}
              loadingText="Sending reset link..."
            >
              Send Reset Link
            </Button>

            <div className="text-center pt-2">
              <Link
                to={`/${ROUTE_PATHS.LOGIN}`}
                className="inline-flex items-center text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-brand-gold-dark)] transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Remembered your password? Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </AuthShell>
  );
};

export default ForgotPassword;
