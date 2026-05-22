import React from 'react';
import { Form, Formik } from 'formik';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Scissors } from 'lucide-react';

import { Button, FormField, Input } from '../../components/common';
import { toast } from '../../components/common/Toast/toastService';
import { ROUTE_PATHS } from '../../constants';
import { setCredentials } from '../../redux/slices/auth/authSlice';
import { useSalonOwnerLoginMutation } from '../../redux/slices/salonOwner/salonOwnerApi';
import { SalonOwnerLoginRequest } from '../../redux/slices/salonOwner/Types';
import { ApiErrorResponse } from '../../redux/slices/api/Types';
import { SalonOwnerLoginSchema } from '../../validations/InvitationSchema';

const SalonOwnerLogin: React.FC = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [salonOwnerLogin, { isLoading }] = useSalonOwnerLoginMutation();

  const handleSubmit = async (
    values: SalonOwnerLoginRequest,
    { setSubmitting }: { setSubmitting: (v: boolean) => void }
  ) => {
    try {
      const response = await salonOwnerLogin(values).unwrap();
      if (response.success && response.data) {
        const { access_token, refresh_token, role, salon_id, email, username } = response.data;
        dispatch(
          setCredentials({
            user: { email, username, role },
            token: access_token,
            refreshToken: refresh_token,
            orgId: salon_id,
          })
        );
        toast.success(response.message || 'Login successful');
        navigate(`/${ROUTE_PATHS.SALON_OWNER_DASHBOARD}`);
      } else {
        toast.error(response.message || 'Login failed');
      }
    } catch (err: unknown) {
      const apiError = err as { data?: ApiErrorResponse };
      toast.error(apiError?.data?.message || 'Invalid email or password');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-md">
        <div className="mb-6 flex flex-col items-center">
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--color-brand-gold)] to-[var(--color-brand-gold-dark)]">
            <Scissors className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">MyChair</h1>
          <p className="mt-1 text-sm text-gray-500">Salon Owner Login</p>
        </div>

        <Formik
          initialValues={{ email: '', password: '' }}
          validationSchema={SalonOwnerLoginSchema}
          onSubmit={handleSubmit}
        >
          {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
            <Form className="flex flex-col gap-4">
              <FormField
                label="Email"
                name="email"
                required
                error={errors.email}
                touched={touched.email}
              >
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={values.email}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  placeholder="owner@salon.com"
                />
              </FormField>
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
              <Button
                type="submit"
                variant="primary"
                fullWidth
                className="!bg-[var(--color-brand-gold)] hover:!bg-[var(--color-brand-gold-dark)]"
                isLoading={isLoading || isSubmitting}
                loadingText="Signing in..."
              >
                Sign In
              </Button>
            </Form>
          )}
        </Formik>
      </div>
    </div>
  );
};

export default SalonOwnerLogin;
