import React, { useEffect, useState } from 'react';

import { Button, FormField, Input, Select } from '../common';
import WeekOffSelector from '../common/WeekOffSelector';
import Modal from '../common/Modal';
import ModalBody from '../common/Modal/ModalBody';
import ModalFooter from '../common/Modal/ModalFooter';
import ModalHeader from '../common/Modal/ModalHeader';
import { EmployeeListItem } from '../../redux/slices/employees/Types';

interface EmployeeEditModalProps {
  open: boolean;
  employee: EmployeeListItem | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    first_name: string;
    last_name: string;
    phone: string;
    role: string;
    branch_name: string;
    weekly_off: string[];
  }) => Promise<void>;
}

const splitName = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return { first: parts[0] ?? '', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
};

const roleOptions = [
  { value: 'salon_manager', label: 'Manager' },
  { value: 'employee', label: 'Staff' },
];

const EmployeeEditModal: React.FC<EmployeeEditModalProps> = ({
  open,
  employee,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('employee');
  const [branchName, setBranchName] = useState('');
  const [weeklyOff, setWeeklyOff] = useState<string[]>([]);

  useEffect(() => {
    if (employee) {
      const { first, last } = splitName(employee.full_name);
      setFirstName(first);
      setLastName(last);
      setPhone(employee.phone ?? '');
      setRole(employee.role);
      setBranchName(employee.branch_name ?? '');
      setWeeklyOff(employee.weekly_off ?? []);
    }
  }, [employee]);

  if (!employee) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      first_name: firstName,
      last_name: lastName,
      phone,
      role,
      branch_name: branchName,
      weekly_off: weeklyOff,
    });
  };

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>
        <ModalHeader>Edit employee</ModalHeader>
        <ModalBody className="flex flex-col gap-4">
          <FormField label="First name" name="first_name" required>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
          </FormField>
          <FormField label="Last name" name="last_name">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </FormField>
          <FormField label="Phone" name="phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormField>
          <FormField label="Role" name="role" required>
            <Select value={role} onChange={(e) => setRole(e.target.value)} options={roleOptions} />
          </FormField>
          <FormField label="Branch" name="branch_name">
            <Input value={branchName} onChange={(e) => setBranchName(e.target.value)} />
          </FormField>
          <WeekOffSelector value={weeklyOff} onChange={setWeeklyOff} />
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
            Save changes
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default EmployeeEditModal;
