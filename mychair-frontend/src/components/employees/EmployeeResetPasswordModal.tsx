import React, { useEffect, useState } from 'react';

import { Button, FormField, PasswordInput } from '../common';
import Modal from '../common/Modal';
import ModalBody from '../common/Modal/ModalBody';
import ModalFooter from '../common/Modal/ModalFooter';
import ModalHeader from '../common/Modal/ModalHeader';
import { EmployeeListItem } from '../../redux/slices/employees/Types';

interface EmployeeResetPasswordModalProps {
  open: boolean;
  employee: EmployeeListItem | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (password: string, confirmPassword: string) => Promise<void>;
}

const EmployeeResetPasswordModal: React.FC<EmployeeResetPasswordModalProps> = ({
  open,
  employee,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setPassword('');
      setConfirmPassword('');
      setError('');
    }
  }, [open, employee?.id]);

  if (!employee) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setError('');
    await onSubmit(password, confirmPassword);
  };

  return (
    <Modal open={open} onClose={onClose} size="md">
      <form onSubmit={handleSubmit}>
        <ModalHeader>Reset password</ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            Set a new password for <span className="font-medium text-gray-800">{employee.full_name}</span>.
          </p>
          <FormField label="New password" name="password" required>
            <PasswordInput
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) setError('');
              }}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </FormField>
          <FormField
            label="Confirm password"
            name="confirm_password"
            required
            error={error}
            touched={!!error}
          >
            <PasswordInput
              value={confirmPassword}
              onChange={(e) => {
                setConfirmPassword(e.target.value);
                if (error) setError('');
              }}
              autoComplete="new-password"
              minLength={8}
              required
            />
          </FormField>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="!bg-[var(--color-brand-gold)] hover:!bg-[var(--color-brand-gold-dark)]"
            isLoading={isSubmitting}
          >
            Reset password
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default EmployeeResetPasswordModal;
