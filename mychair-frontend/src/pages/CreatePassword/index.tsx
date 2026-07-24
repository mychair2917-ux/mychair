import React, { useMemo } from 'react';
import { Form, Formik } from 'formik';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Scissors } from 'lucide-react';

import { Button, FormField, Input } from '../../components/common';
import { showToast } from '../../components/common/Toast/toastService';
import { getApiErrorMessage } from '../../utils/apiErrors';
import { ROUTE_PATHS } from '../../constants';
import { useCreatePasswordMutation, useValidateInvitationQuery } from '../../redux/slices/invitations/invitationsApi';
import { ApiErrorResponse } from '../../redux/slices/api/Types';
import { CreatePasswordSchema } from '../../validations/InvitationSchema';

interface CreatePasswordFormValues {
  password: string;
  confirm_password: string;
}

const CreatePassword: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') || '';

  const { data: validationData, isLoading: isValidating, error: validationError } =
    useValidateInvitationQuery(token, { skip: !token });

  const [createPassword, { isLoading }] = useCreatePasswordMutation();

  const salonInfo = useMemo(() => validationData?.data, [validationData]);

  const handleSubmit = async (
    values: CreatePasswordFormValues,
    { setSubmitting }: { setSubmitting: (v: boolean) => void }
  ) => {
    try {
      const response = await createPassword({
        token,
        password: values.password,
        confirm_password: values.confirm_password,
      }).unwrap();

      if (response.success) {
        showToast('success', response.message || 'Password created successfully');
        const role = response.data?.role ?? salonInfo?.role;
        if (role === 'salon_owner') {
          navigate(`/${ROUTE_PATHS.SALON_OWNER_LOGIN}`);
        } else {
          navigate(`/${ROUTE_PATHS.LOGIN}`);
        }
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
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 sm:p-6">
        <div className="max-w-md rounded-xl bg-white p-5 text-center shadow-md sm:p-8">
          <p className="text-red-600">Invalid invitation link. No token provided.</p>
        </div>
      </div>
    );
  }

  if (isValidating) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 sm:p-6">
        <p className="text-gray-600">Validating invitation...</p>
      </div>
    );
  }

  if (validationError || !salonInfo?.is_valid) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 sm:p-6">
        <div className="max-w-md rounded-xl bg-white p-5 text-center shadow-md sm:p-8">
          <p className="text-red-600">
            {(validationError as { data?: ApiErrorResponse })?.data?.message ||
              'This invitation link is invalid or has expired.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4 sm:p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-md sm:p-8">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-brand-gold)] to-[var(--color-brand-gold-dark)]">
            <Scissors className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">MyChair</h1>
          <p className="mt-1 text-sm text-gray-500">Create your account password</p>
        </div>

        <div className="mb-6 rounded-lg bg-gray-50 p-4 text-sm">
          <p>
            <span className="font-medium text-gray-700">Salon:</span> {salonInfo.salon_name}
          </p>
          <p className="mt-1">
            <span className="font-medium text-gray-700">Email:</span> {salonInfo.email}
          </p>
        </div>

        <Formik
          initialValues={{ password: '', confirm_password: '' }}
          validationSchema={CreatePasswordSchema}
          onSubmit={handleSubmit}
        >
          {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
            <Form className="flex flex-col gap-4">
              <FormField
                label="Password"
                name="password"
                required
                error={errors.password}
                touched={touched.password}
              >
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={values.password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Enter password"
                />
              </FormField>
              <FormField
                label="Confirm Password"
                name="confirm_password"
                required
                error={errors.confirm_password}
                touched={touched.confirm_password}
              >
                <Input
                  id="confirm_password"
                  name="confirm_password"
                  type="password"
                  value={values.confirm_password}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="Confirm password"
                />
              </FormField>
              <Button
                type="submit"
                variant="primary"
                fullWidth
                className="mt-2 !bg-[var(--color-brand-gold)] hover:!bg-[var(--color-brand-gold-dark)]"
                isLoading={isLoading || isSubmitting}
                loadingText="Creating..."
              >
                Create Password
              </Button>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default CreatePassword;
