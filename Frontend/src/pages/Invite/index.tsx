import React, { useState } from 'react';
import { Form, Formik } from 'formik';
import { MailPlus, UserPlus } from 'lucide-react';

import { Button, FormField, Input } from '../../components/common';
import Modal from '../../components/common/Modal';
import ModalBody from '../../components/common/Modal/ModalBody';
import ModalFooter from '../../components/common/Modal/ModalFooter';
import ModalHeader from '../../components/common/Modal/ModalHeader';
import { toast } from '../../components/common/Toast/toastService';
import { useCreateInvitationMutation } from '../../redux/slices/invitations/invitationsApi';
import { CreateInvitationRequest } from '../../redux/slices/invitations/Types';
import { ApiErrorResponse } from '../../redux/slices/api/Types';
import { InvitationSchema } from '../../validations/InvitationSchema';

const initialValues: CreateInvitationRequest = {
  salon_name: '',
  slug: '',
  email: '',
  username: '',
  address: '',
};

const Invite: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [createInvitation, { isLoading }] = useCreateInvitationMutation();

  const handleClose = () => setIsModalOpen(false);

  const handleSubmit = async (
    values: CreateInvitationRequest,
    { resetForm, setSubmitting }: { resetForm: () => void; setSubmitting: (v: boolean) => void }
  ) => {
    try {
      const response = await createInvitation(values).unwrap();
      if (response.success) {
        toast.success(response.message || 'Invitation sent successfully');
        resetForm();
        handleClose();
      } else {
        toast.error(response.message || 'Failed to send invitation');
      }
    } catch (err: unknown) {
      const apiError = err as { data?: ApiErrorResponse };
      const message = apiError?.data?.message || 'Failed to send invitation';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] md:text-3xl">
            Invite Salon Owner
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Send invitations to salon owners to join the MyChair platform.
          </p>
        </div>
        <Button
          variant="primary"
          className="!bg-[var(--color-brand-gold)] hover:!bg-[var(--color-brand-gold-dark)] !px-6"
          onClick={() => setIsModalOpen(true)}
        >
          <UserPlus className="h-4 w-4" />
          Invite
        </Button>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-brand-gold)]/10">
            <MailPlus className="h-8 w-8 text-[var(--color-brand-gold)]" />
          </div>
          <h2 className="text-lg font-semibold text-gray-800">No invitations yet</h2>
          <p className="mt-2 max-w-md text-sm text-gray-500">
            Click the Invite button above to send an invitation to a new salon owner.
            They will receive an email with a link to set up their account.
          </p>
          <Button
            variant="primary"
            className="mt-6 !bg-[var(--color-brand-gold)] hover:!bg-[var(--color-brand-gold-dark)]"
            onClick={() => setIsModalOpen(true)}
          >
            <UserPlus className="h-4 w-4" />
            Send Invitation
          </Button>
        </div>
      </div>

      <Modal open={isModalOpen} onClose={handleClose} size="lg" isShowIcon>
        <ModalHeader>
          <h2 className="text-xl font-semibold">Invite Salon Owner</h2>
        </ModalHeader>
        <Formik
          initialValues={initialValues}
          validationSchema={InvitationSchema}
          onSubmit={handleSubmit}
        >
          {({ values, errors, touched, handleChange, handleBlur, isSubmitting }) => (
            <Form>
              <ModalBody className="!pt-0">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
                      placeholder="e.g. Glamour Studio"
                    />
                  </FormField>
                  <FormField
                    label="Slug"
                    name="slug"
                    required
                    error={errors.slug}
                    touched={touched.slug}
                  >
                    <Input
                      id="slug"
                      name="slug"
                      value={values.slug}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="e.g. glamour-studio"
                    />
                  </FormField>
                  <FormField
                    label="Email ID"
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
                    label="Username"
                    name="username"
                    required
                    error={errors.username}
                    touched={touched.username}
                  >
                    <Input
                      id="username"
                      name="username"
                      value={values.username}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      placeholder="e.g. glamour_admin"
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
                      placeholder="Full salon address"
                    />
                  </FormField>
                </div>
              </ModalBody>
              <ModalFooter className="!pt-0">
                <Button type="button" variant="secondary" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  className="!bg-[var(--color-brand-gold)] hover:!bg-[var(--color-brand-gold-dark)]"
                  isLoading={isLoading || isSubmitting}
                  loadingText="Sending..."
                >
                  Send Invitation
                </Button>
              </ModalFooter>
            </Form>
          )}
        </Formik>
      </Modal>
    </div>
  );
};

export default Invite;
