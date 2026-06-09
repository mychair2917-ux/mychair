import React, { useState } from 'react';
import { Form, Formik, FormikHelpers } from 'formik';
import * as Yup from 'yup';

import { Button, FormField, Input, Select } from '../common';
import Modal from '../common/Modal';
import ModalBody from '../common/Modal/ModalBody';
import ModalFooter from '../common/Modal/ModalFooter';
import ModalHeader from '../common/Modal/ModalHeader';
import { showToast } from '../common/Toast/toastService';
import {
  CreateInviteRequest,
  InvitationFormOptionsData,
} from '../../redux/slices/invitations/Types';
import {
  buildInviteValidationSchema,
  defaultInviteFormValues,
  InviteFormValues,
} from '../../validations/inviteSchema';
import {
  isSalonOwnerInviteRole,
  isStaffInviteRole,
  requiresTenantSelection,
  usesDirectPasswordProvisioning,
} from '../../utils/invitePermissions';
import { applyApiFieldErrors, getApiErrorMessage } from '../../utils/apiErrors';
import { formatDateDMY } from '../../utils/utilities';
import { cn } from '../../utils/cn';
import SalonLocationPicker, { type SalonLocation } from '../attendance/SalonLocationPicker';
import WeekOffSelector from '../common/WeekOffSelector';

const SALARY_TYPE_OPTIONS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
];

interface InviteFormModalProps {
  open: boolean;
  onClose: () => void;
  inviterRole: string;
  formOptions?: InvitationFormOptionsData;
  isLoadingOptions?: boolean;
  onSubmit: (payload: CreateInviteRequest) => Promise<{ success: boolean; message?: string }>;
  isSubmitting?: boolean;
}

const InviteFormModal: React.FC<InviteFormModalProps> = ({
  open,
  onClose,
  inviterRole,
  formOptions,
  isLoadingOptions,
  onSubmit,
  isSubmitting,
}) => {
  const [salonOwnerStep, setSalonOwnerStep] = useState(1);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const roleOptions = formOptions?.invitable_roles ?? [];
  const initialRole = roleOptions[0]?.value ?? '';

  const buildPayload = (values: InviteFormValues): CreateInviteRequest => {
    const payload: CreateInviteRequest = {
      role: values.role,
      full_name: values.full_name.trim(),
      email: values.email.trim(),
    };
    if (values.phone?.trim()) payload.phone = values.phone.trim();
    if (values.password) payload.password = values.password;
    if (values.confirm_password) payload.confirm_password = values.confirm_password;
    if (values.username?.trim()) payload.username = values.username.trim();
    if (values.tenant_id) payload.tenant_id = values.tenant_id;
    if (values.branch_name?.trim()) payload.branch_name = values.branch_name.trim();
    if (values.reporting_manager_id) payload.reporting_manager_id = values.reporting_manager_id;

    if (isSalonOwnerInviteRole(values.role)) {
      payload.salon_name = values.salon_name.trim();
      payload.salon_type = values.salon_type;
      payload.subscription_plan = values.subscription_plan;
      payload.latitude = values.latitude;
      payload.longitude = values.longitude;
      payload.attendance_radius = values.attendance_radius;
      payload.shift_start = values.shift_start;
      if (values.salon_phone_number?.trim()) {
        payload.salon_phone_number = values.salon_phone_number.trim();
      }
      if (values.address?.trim()) payload.address = values.address.trim();
      if (values.gst_number?.trim()) payload.gst_number = values.gst_number.trim();
    }

    if (isStaffInviteRole(values.role)) {
      payload.salary = Number(values.salary);
      payload.salary_type = values.salary_type;
      payload.joining_date = values.joining_date;
      payload.incentive_base = values.incentive_base;
      if (values.incentive_base) {
        payload.service_incentive_percent = Number(values.service_incentive_percent);
        payload.product_incentive_percent = Number(values.product_incentive_percent);
      }
      if (values.weekly_off.length > 0) {
        payload.weekly_off = values.weekly_off;
      }
    }
    return payload;
  };

  const handleSubmit = async (
    values: InviteFormValues,
    helpers: FormikHelpers<InviteFormValues>
  ) => {
    const { setFieldError, setSubmitting, resetForm } = helpers;
    try {
      const result = await onSubmit(buildPayload(values));
      if (result.success) {
        const directSetup = usesDirectPasswordProvisioning(inviterRole, values.role);
        // Stop submitting state BEFORE closing to avoid state update on unmounted component
        setSubmitting(false);
        showToast(
          'success',
          result.message ||
            (directSetup
              ? 'Team member account created. They can sign in with their email and password.'
              : 'Invitation sent successfully. The user will receive an email to set their password.')
        );
        resetForm();
        setSalonOwnerStep(1);
        setLocationConfirmed(false);
        onClose();
        return;
      } else {
        showToast('error', result.message || 'Failed to send invitation');
      }
    } catch (err: unknown) {
      const apiError = err as { data?: { errors?: Record<string, string[]> | null } };
      const hasFieldErrors = applyApiFieldErrors(apiError?.data?.errors, setFieldError);
      if (!hasFieldErrors) {
        showToast('error', getApiErrorMessage(err, 'Failed to send invitation'));
      } else {
        showToast('error', getApiErrorMessage(err, 'Please correct the highlighted fields'));
      }
    }
    setSubmitting(false);
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        setSalonOwnerStep(1);
        setLocationConfirmed(false);
        onClose();
      }}
      size="lg"
      isShowIcon
    >
      <ModalHeader>
        <h2 className="text-xl font-semibold">Invite User</h2>
        <p className="mt-0.5 text-sm text-gray-500">All users sign in with email and password.</p>
      </ModalHeader>
      <Formik<InviteFormValues>
        initialValues={{ ...defaultInviteFormValues, role: initialRole }}
        enableReinitialize
        validate={async (values) => {
          const directSetup = usesDirectPasswordProvisioning(inviterRole, values.role);
          const schema = buildInviteValidationSchema(
            values.role,
            requiresTenantSelection(inviterRole, values.role),
            directSetup
          );
          try {
            await schema.validate(values, { abortEarly: false });
            return {};
          } catch (err) {
            if (err instanceof Yup.ValidationError) {
              return err.inner.reduce(
                (acc, item) => {
                  if (item.path) acc[item.path] = item.message;
                  return acc;
                },
                {} as Record<string, string>
              );
            }
            return {};
          }
        }}
        onSubmit={handleSubmit}
      >
        {({
          values,
          errors,
          touched,
          handleChange,
          handleBlur,
          setFieldValue,
          isSubmitting: formSubmitting,
        }) => {
          const needsTenant = requiresTenantSelection(inviterRole, values.role);
          const showSalonSetup = isSalonOwnerInviteRole(values.role);
          const showTeamFields = isStaffInviteRole(values.role);
          const directPasswordSetup = usesDirectPasswordProvisioning(inviterRole, values.role);
          const showSalonStepOne = showSalonSetup && salonOwnerStep === 1;
          const showSalonStepTwo = showSalonSetup && salonOwnerStep === 2;

          return (
            <Form noValidate>
              <ModalBody className="!pt-0">
                {showSalonSetup && (
                  <div className="mb-4 flex items-center gap-3 rounded-2xl bg-[var(--color-surface-muted)] px-4 py-3 text-sm">
                    <span className={cn('font-semibold', salonOwnerStep === 1 && 'text-[var(--color-brand-gold)]')}>
                      Step 1: Salon Details
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className={cn('font-semibold', salonOwnerStep === 2 && 'text-[var(--color-brand-gold)]')}>
                      Step 2: Confirm Pin on Map
                    </span>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {/* Role selector */}
                  <FormField
                    label="Role"
                    name="role"
                    required
                    error={errors.role}
                    touched={touched.role}
                    className="md:col-span-2"
                  >
                    <Select
                      id="role"
                      name="role"
                      value={values.role}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      options={roleOptions}
                      placeholder={isLoadingOptions ? 'Loading...' : 'Select role'}
                      disabled={isLoadingOptions || roleOptions.length === 0}
                    />
                  </FormField>

                  {/* Salon selector for super admin inviting staff */}
                  {needsTenant && (
                    <FormField
                      label="Salon"
                      name="tenant_id"
                      required
                      error={errors.tenant_id}
                      touched={touched.tenant_id}
                      className="md:col-span-2"
                    >
                      <Select
                        id="tenant_id"
                        name="tenant_id"
                        value={values.tenant_id}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        options={formOptions?.tenants ?? []}
                        placeholder="Select salon"
                      />
                    </FormField>
                  )}

                  {/* Salon owner step 1 */}
                  {showSalonStepOne && (
                    <>
                      <FormField
                        label="Salon Name"
                        name="salon_name"
                        required
                        error={errors.salon_name}
                        touched={touched.salon_name}
                      >
                        <Input
                          id="salon_name"
                          name="salon_name"
                          value={values.salon_name}
                          onChange={handleChange}
                          onBlur={handleBlur}
                        />
                      </FormField>
                      <FormField
                        label="Salon Type"
                        name="salon_type"
                        required
                        error={errors.salon_type}
                        touched={touched.salon_type}
                      >
                        <Select
                          id="salon_type"
                          name="salon_type"
                          value={values.salon_type}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          options={formOptions?.salon_types ?? []}
                          placeholder="Select salon type"
                        />
                      </FormField>
                      <FormField
                        label="Subscription Plan"
                        name="subscription_plan"
                        required
                        error={errors.subscription_plan}
                        touched={touched.subscription_plan}
                      >
                        <Select
                          id="subscription_plan"
                          name="subscription_plan"
                          value={values.subscription_plan}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          options={formOptions?.subscription_plans ?? []}
                          placeholder="Select plan"
                        />
                      </FormField>
                      <FormField
                        label="Salon Phone"
                        name="salon_phone_number"
                        error={errors.salon_phone_number}
                        touched={touched.salon_phone_number}
                      >
                        <Input
                          id="salon_phone_number"
                          name="salon_phone_number"
                          type="tel"
                          value={values.salon_phone_number}
                          onChange={handleChange}
                          onBlur={handleBlur}
                        />
                      </FormField>
                      <FormField
                        label="GST Number"
                        name="gst_number"
                        error={errors.gst_number}
                        touched={touched.gst_number}
                      >
                        <Input
                          id="gst_number"
                          name="gst_number"
                          value={values.gst_number}
                          onChange={handleChange}
                          onBlur={handleBlur}
                        />
                      </FormField>
                      <FormField
                        label="Branch Name"
                        name="branch_name"
                        error={errors.branch_name}
                        touched={touched.branch_name}
                      >
                        <Input
                          id="branch_name"
                          name="branch_name"
                          value={values.branch_name}
                          onChange={handleChange}
                          onBlur={handleBlur}
                        />
                      </FormField>
                    </>
                  )}

                  {/* Salon owner step 2 — salon location picker */}
                  {showSalonStepTwo && (
                    <div className="md:col-span-2 space-y-5">
                      <SalonLocationPicker
                        embedded
                        skipDoneStep
                        initialLocation={
                          locationConfirmed
                            ? { latitude: values.latitude, longitude: values.longitude }
                            : undefined
                        }
                        onConfirm={(loc: SalonLocation) => {
                          const fullAddress = [loc.address, loc.city, loc.state, loc.pincode]
                            .filter(Boolean)
                            .join(', ');
                          setFieldValue('address', fullAddress);
                          setFieldValue('latitude', loc.latitude);
                          setFieldValue('longitude', loc.longitude);
                          setLocationConfirmed(true);
                        }}
                      />
                      {locationConfirmed && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                          <FormField label="Shift Start (HH:MM)" name="shift_start">
                            <Input
                              id="shift_start"
                              name="shift_start"
                              value={values.shift_start}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              placeholder="09:00"
                            />
                          </FormField>
                          <FormField
                            label="Attendance Radius (meters)"
                            name="attendance_radius"
                            error={errors.attendance_radius}
                            touched={touched.attendance_radius}
                          >
                            <Input
                              id="attendance_radius"
                              type="number"
                              min={10}
                              max={5000}
                              name="attendance_radius"
                              value={values.attendance_radius}
                              onChange={handleChange}
                              onBlur={handleBlur}
                            />
                          </FormField>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Common personal details — same for all roles */}
                  {!showSalonStepTwo && (
                    <>
                  <FormField
                    label="Full Name"
                    name="full_name"
                    required
                    error={errors.full_name}
                    touched={touched.full_name}
                  >
                    <Input
                      id="full_name"
                      name="full_name"
                      value={values.full_name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                    />
                  </FormField>

                  {/* Email — required for ALL roles */}
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
                      placeholder="Used to sign in"
                    />
                  </FormField>

                  {/* Phone — always optional, contact field only */}
                  <FormField
                    label="Phone"
                    name="phone"
                    error={errors.phone}
                    touched={touched.phone}
                  >
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={values.phone}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="Optional contact number"
                    />
                  </FormField>
                    </>
                  )}

                  {/* Password fields — only when creating staff/manager account */}
                  {!showSalonStepTwo && directPasswordSetup && (
                    <>
                      <FormField
                        label="Username"
                        name="username"
                        error={errors.username}
                        touched={touched.username}
                      >
                        <Input
                          id="username"
                          name="username"
                          value={values.username}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder="Optional display name"
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
                          placeholder="Login password"
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
                        />
                      </FormField>
                    </>
                  )}

                  {/* Team-specific fields */}
                  {!showSalonStepTwo && showTeamFields && (
                    <>
                      <FormField
                        label="Branch"
                        name="branch_name"
                        error={errors.branch_name}
                        touched={touched.branch_name}
                      >
                        <Select
                          id="branch_name"
                          name="branch_name"
                          value={values.branch_name}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          options={formOptions?.branches ?? []}
                          placeholder="Select branch"
                        />
                      </FormField>
                      {values.role === 'employee' && (
                        <FormField
                          label="Reporting Manager"
                          name="reporting_manager_id"
                          error={errors.reporting_manager_id}
                          touched={touched.reporting_manager_id}
                        >
                          <Select
                            id="reporting_manager_id"
                            name="reporting_manager_id"
                            value={values.reporting_manager_id}
                            onChange={handleChange}
                            onBlur={handleBlur}
                            options={formOptions?.managers ?? []}
                            placeholder="Optional"
                          />
                        </FormField>
                      )}

                      {/* Salary configuration */}
                      <div className="md:col-span-2 mt-1 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)]/60 p-4">
                        <p className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
                          Salary & Incentives
                        </p>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          <FormField
                            label="Salary"
                            name="salary"
                            required
                            error={errors.salary}
                            touched={touched.salary}
                          >
                            <Input
                              id="salary"
                              name="salary"
                              type="number"
                              min={0}
                              step="0.01"
                              value={values.salary}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              placeholder="e.g. 30000"
                            />
                          </FormField>
                          <FormField
                            label="Salary Type"
                            name="salary_type"
                            required
                            error={errors.salary_type}
                            touched={touched.salary_type}
                          >
                            <Select
                              id="salary_type"
                              name="salary_type"
                              value={values.salary_type}
                              onChange={handleChange}
                              onBlur={handleBlur}
                              options={SALARY_TYPE_OPTIONS}
                              placeholder="Select salary type"
                            />
                          </FormField>
                          <FormField
                            label="Joining Date"
                            name="joining_date"
                            required
                            error={errors.joining_date}
                            touched={touched.joining_date}
                          >
                            <Input
                              id="joining_date"
                              name="joining_date"
                              type="date"
                              value={values.joining_date}
                              onChange={handleChange}
                              onBlur={handleBlur}
                            />
                            {values.joining_date && (
                              <span className="mt-1 block text-xs text-gray-500">
                                {formatDateDMY(values.joining_date)}
                              </span>
                            )}
                          </FormField>
                          <FormField
                            label="Incentive Based"
                            name="incentive_base"
                            required
                            error={errors.incentive_base as string | undefined}
                            touched={touched.incentive_base}
                          >
                            <label className="flex h-10 items-center gap-3">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={values.incentive_base}
                                onClick={() =>
                                  setFieldValue('incentive_base', !values.incentive_base)
                                }
                                className={cn(
                                  'relative inline-flex h-6 w-11 items-center rounded-full transition-colors',
                                  values.incentive_base
                                    ? 'bg-[var(--color-brand-gold)]'
                                    : 'bg-gray-300'
                                )}
                              >
                                <span
                                  className={cn(
                                    'inline-block h-4 w-4 transform rounded-full bg-white transition-transform',
                                    values.incentive_base ? 'translate-x-6' : 'translate-x-1'
                                  )}
                                />
                              </button>
                              <span className="text-sm text-[var(--color-text-secondary)]">
                                {values.incentive_base ? 'Yes' : 'No'}
                              </span>
                            </label>
                          </FormField>

                          {values.incentive_base && (
                            <>
                              <FormField
                                label="Service Incentive %"
                                name="service_incentive_percent"
                                required
                                error={errors.service_incentive_percent}
                                touched={touched.service_incentive_percent}
                              >
                                <Input
                                  id="service_incentive_percent"
                                  name="service_incentive_percent"
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="0.01"
                                  value={values.service_incentive_percent}
                                  onChange={handleChange}
                                  onBlur={handleBlur}
                                  placeholder="e.g. 10"
                                />
                              </FormField>
                              <FormField
                                label="Product Incentive %"
                                name="product_incentive_percent"
                                required
                                error={errors.product_incentive_percent}
                                touched={touched.product_incentive_percent}
                              >
                                <Input
                                  id="product_incentive_percent"
                                  name="product_incentive_percent"
                                  type="number"
                                  min={0}
                                  max={100}
                                  step="0.01"
                                  value={values.product_incentive_percent}
                                  onChange={handleChange}
                                  onBlur={handleBlur}
                                  placeholder="e.g. 5"
                                />
                              </FormField>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="md:col-span-2 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-bg)]/60 p-4">
                        <WeekOffSelector
                          value={values.weekly_off}
                          onChange={(days) => setFieldValue('weekly_off', days)}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Login info hint */}
                {!showSalonStepTwo && (
                  <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-700">
                    {directPasswordSetup
                      ? 'The account will be created immediately. Share the email and password with the team member manually.'
                      : 'An invitation email will be sent. The salon owner will click the link to set their password and activate their account.'}
                  </div>
                )}
              </ModalBody>
              <ModalFooter className="!pt-0">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setSalonOwnerStep(1);
                    onClose();
                  }}
                >
                  Cancel
                </Button>
                {showSalonStepOne ? (
                  <Button
                    type="button"
                    variant="primary"
                    className="!bg-[var(--color-brand-gold)] hover:!bg-[var(--color-brand-gold-dark)]"
                    onClick={async () => {
                      const schema = buildInviteValidationSchema(
                        values.role,
                        requiresTenantSelection(inviterRole, values.role),
                        false
                      ).pick([
                        'role',
                        'full_name',
                        'email',
                        'phone',
                        'salon_name',
                        'salon_type',
                        'subscription_plan',
                        'salon_phone_number',
                        'gst_number',
                        'branch_name',
                      ]);
                      try {
                        await schema.validate(values, { abortEarly: false });
                        setLocationConfirmed(false);
                        setSalonOwnerStep(2);
                      } catch (err) {
                        if (err instanceof Yup.ValidationError) {
                          showToast('error', err.errors[0] || 'Please complete salon details');
                        }
                      }
                    }}
                  >
                    Next: Search Location
                  </Button>
                ) : showSalonStepTwo ? (
                  <>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => {
                        setSalonOwnerStep(1);
                        setLocationConfirmed(false);
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      className="!bg-[var(--color-brand-gold)] hover:!bg-[var(--color-brand-gold-dark)]"
                      isLoading={isSubmitting || formSubmitting}
                      loadingText="Sending..."
                      disabled={!locationConfirmed}
                      onClick={(event) => {
                        if (!locationConfirmed) {
                          event.preventDefault();
                          showToast('error', 'Please select a valid salon location.');
                        }
                      }}
                    >
                      Send Invitation
                    </Button>
                  </>
                ) : (
                  <Button
                    type="submit"
                    variant="primary"
                    className="!bg-[var(--color-brand-gold)] hover:!bg-[var(--color-brand-gold-dark)]"
                    isLoading={isSubmitting || formSubmitting}
                    loadingText={directPasswordSetup ? 'Creating...' : 'Sending...'}
                  >
                    {directPasswordSetup ? 'Create Account' : 'Send Invitation'}
                  </Button>
                )}
              </ModalFooter>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
};

export default InviteFormModal;
