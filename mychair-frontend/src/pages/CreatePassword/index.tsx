import React, { useMemo, useState } from 'react';
import { Form, Formik } from 'formik';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, Lock } from 'lucide-react';

import { Button, FormField } from '../../components/common';
import { showToast } from '../../components/common/Toast/toastService';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { ROUTE_PATHS } from '../../constants';
import { useCreatePasswordMutation, useValidateInvitationQuery } from '../../redux/slices/invitations/invitationsApi';
import { ApiErrorResponse } from '../../redux/slices/api/Types';
import { CreatePasswordSchema } from '../../validations/InvitationSchema';

import { hashPassword } from '../../utils/crypto';

interface CreatePasswordFormValues {
  password: string;
  confirm_password: string;
}

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

const PasswordField: React.FC<{
  id: string;
  name: string;
  label: string;
  value: string;
  placeholder: string;
  error?: string;
  touched?: boolean;
  required?: boolean;
  autoComplete?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
}> = ({
  id,
  name,
  label,
  value,
  placeholder,
  error,
  touched,
  required,
  autoComplete,
  onChange,
  onBlur,
}) => {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <FormField label={label} name={name} required={required} error={error} touched={touched}>
      <div className="relative">
        <Lock
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-text-tertiary)]"
          aria-hidden="true"
        />
        <input
          id={id}
          name={name}
          type={showPassword ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          className={fieldClassName}
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
    </FormField>
  );
};

const CreatePassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const { data: validationData, isLoading: isValidating, error: validationError } =
    useValidateInvitationQuery(token, {
      skip: !token,
      refetchOnMountOrArgChange: true,
    });

  const [createPassword, { isLoading }] = useCreatePasswordMutation();

  const salonInfo = useMemo(() => validationData?.data, [validationData]);

  const handleSubmit = async (
    values: CreatePasswordFormValues,
    { setSubmitting }: { setSubmitting: (v: boolean) => void }
  ) => {
    try {
      const hashedPassword = await hashPassword(values.password);
      const hashedConfirmPassword = await hashPassword(values.confirm_password);
      const response = await createPassword({
        token,
        password: hashedPassword,
        confirm_password: hashedConfirmPassword,
      }).unwrap();

      if (response.success) {
        showToast('success', response.message || 'Password created successfully');
        navigate(`/${ROUTE_PATHS.LOGIN}`, { replace: true });
      } else {
        showToast('error', response.message || 'Failed to create password');
      }
    } catch (err: unknown) {
      showToast('error', getApiErrorMessage(err, 'Failed to create password'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return (
      <AuthShell>
        <div className="rounded-[20px] border border-[var(--color-border-soft)] bg-white px-7 py-8 text-center shadow-[0_12px_40px_rgba(31,31,30,0.06)] sm:px-9 sm:py-10">
          <p className="text-sm text-red-600">Invalid invitation link. No token provided.</p>
        </div>
      </AuthShell>
    );
  }

  if (isValidating) {
    return (
      <AuthShell>
        <div className="rounded-[20px] border border-[var(--color-border-soft)] bg-white px-7 py-8 text-center shadow-[0_12px_40px_rgba(31,31,30,0.06)] sm:px-9 sm:py-10">
          <p className="text-sm text-[var(--color-text-secondary)]">Validating invitation...</p>
        </div>
      </AuthShell>
    );
  }

  if (validationError || !salonInfo?.is_valid) {
    return (
      <AuthShell>
        <div className="rounded-[20px] border border-[var(--color-border-soft)] bg-white px-7 py-8 text-center shadow-[0_12px_40px_rgba(31,31,30,0.06)] sm:px-9 sm:py-10">
          <p className="text-sm text-red-600">
            {(validationError as { data?: ApiErrorResponse })?.data?.message ||
              'This invitation link is invalid or has expired.'}
          </p>
        </div>
      </AuthShell>
    );
  }

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
            Create your password
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[var(--color-text-secondary)]">
            Set a password to activate your MyChair account
          </p>
        </div>

        <div className="mb-6 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)] px-4 py-3.5 text-sm">
          <p className="text-[var(--color-text-primary)]">
            <span className="font-medium text-[var(--color-text-secondary)]">Salon:</span>{' '}
            {salonInfo.salon_name}
          </p>
          <p className="mt-1.5 text-[var(--color-text-primary)]">
            <span className="font-medium text-[var(--color-text-secondary)]">Email:</span>{' '}
            {salonInfo.email}
          </p>
        </div>

        <Formik
          initialValues={{ password: '', confirm_password: '' }}
          validationSchema={CreatePasswordSchema}
          onSubmit={handleSubmit}
        >
          {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
            <Form className="flex flex-col gap-5">
              <PasswordField
                id="password"
                name="password"
                label="Password"
                required
                value={values.password}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Enter password"
                autoComplete="new-password"
                error={errors.password}
                touched={touched.password}
              />
              <PasswordField
                id="confirm_password"
                name="confirm_password"
                label="Confirm Password"
                required
                value={values.confirm_password}
                onChange={handleChange}
                onBlur={handleBlur}
                placeholder="Confirm password"
                autoComplete="new-password"
                error={errors.confirm_password}
                touched={touched.confirm_password}
              />
              <Button
                type="submit"
                variant="primary"
                size="lg"
                fullWidth
                className="mt-2 h-12 rounded-xl text-[0.95rem] shadow-md shadow-[rgba(197,160,89,0.25)]"
                isLoading={isLoading || isSubmitting}
                loadingText="Creating..."
              >
                Create Password
              </Button>
            </Form>
          )}
        </Formik>
      </div>
    </AuthShell>
  );
};

export default CreatePassword;
