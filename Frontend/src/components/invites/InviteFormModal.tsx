import React from 'react';
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
  requiresTenantSelection,
} from '../../utils/invitePermissions';
import { applyApiFieldErrors, getApiErrorMessage } from '../../utils/apiErrors';

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
  const roleOptions = formOptions?.invitable_roles ?? [];
  const initialRole = roleOptions[0]?.value ?? '';

  const buildPayload = (values: InviteFormValues): CreateInviteRequest => {
    const payload: CreateInviteRequest = {
      role: values.role,
      full_name: values.full_name.trim(),
      email: values.email.trim(),
    };
    if (values.phone?.trim()) payload.phone = values.phone.trim();
    if (values.tenant_id) payload.tenant_id = values.tenant_id;
    if (values.branch_name?.trim()) payload.branch_name = values.branch_name.trim();
    if (values.reporting_manager_id) payload.reporting_manager_id = values.reporting_manager_id;

    if (isSalonOwnerInviteRole(values.role)) {
      payload.salon_name = values.salon_name.trim();
      payload.salon_type = values.salon_type;
      payload.subscription_plan = values.subscription_plan;
      if (values.salon_phone_number?.trim()) {
        payload.salon_phone_number = values.salon_phone_number.trim();
      }
      if (values.address?.trim()) payload.address = values.address.trim();
      if (values.gst_number?.trim()) payload.gst_number = values.gst_number.trim();
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
        showToast('success', result.message || 'Invitation sent successfully');
        resetForm();
        onClose();
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
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} size="lg" isShowIcon>
      <ModalHeader>
        <h2 className="text-xl font-semibold">Invite User</h2>
      </ModalHeader>
      <Formik<InviteFormValues>
        initialValues={{ ...defaultInviteFormValues, role: initialRole }}
        enableReinitialize
        validate={async (values) => {
          const schema = buildInviteValidationSchema(
            values.role,
            requiresTenantSelection(inviterRole, values.role)
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
        {({ values, errors, touched, handleChange, handleBlur, isSubmitting: formSubmitting }) => {
          const needsTenant = requiresTenantSelection(inviterRole, values.role);
          const showSalonSetup = isSalonOwnerInviteRole(values.role);
          const showTeamFields = Boolean(values.role && !showSalonSetup);

          return (
            <Form noValidate>
              <ModalBody className="!pt-0">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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

                  {showSalonSetup && (
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
                        label="Address"
                        name="address"
                        error={errors.address}
                        touched={touched.address}
                        className="md:col-span-2"
                      >
                        <Input
                          id="address"
                          name="address"
                          value={values.address}
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
                    />
                  </FormField>
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
                    />
                  </FormField>

                  {showTeamFields && (
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
                    </>
                  )}
                </div>
              </ModalBody>
              <ModalFooter className="!pt-0">
                <Button type="button" variant="secondary" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="!bg-[var(--color-brand-gold)] hover:!bg-[var(--color-brand-gold-dark)]"
                  isLoading={isSubmitting || formSubmitting}
                  loadingText="Sending..."
                >
                  Send Invitation
                </Button>
              </ModalFooter>
            </Form>
          );
        }}
      </Formik>
    </Modal>
  );
};

export default InviteFormModal;
