import React, { useState } from 'react';

import { Button, FormField, Input } from '../common';
import Modal from '../common/Modal';
import ModalBody from '../common/Modal/ModalBody';
import ModalFooter from '../common/Modal/ModalFooter';
import ModalHeader from '../common/Modal/ModalHeader';
import { toDateInputValue } from '../../utils/utilities';

interface LeaveApplyModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: { leave_date: string; leave_reason: string }) => Promise<void>;
  isLoading?: boolean;
}

const LeaveApplyModal: React.FC<LeaveApplyModalProps> = ({
  open,
  onClose,
  onSubmit,
  isLoading = false,
}) => {
  const [leaveDate, setLeaveDate] = useState(toDateInputValue(new Date()));
  const [leaveReason, setLeaveReason] = useState('');
  const [errors, setErrors] = useState<{ leave_date?: string; leave_reason?: string }>({});

  const handleClose = () => {
    setLeaveDate(toDateInputValue(new Date()));
    setLeaveReason('');
    setErrors({});
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!leaveDate) nextErrors.leave_date = 'Leave date is required';
    if (!leaveReason.trim()) nextErrors.leave_reason = 'Leave reason is required';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    await onSubmit({ leave_date: leaveDate, leave_reason: leaveReason.trim() });
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} size="md" isShowIcon>
      <form onSubmit={handleSubmit}>
        <ModalHeader>Apply Leave</ModalHeader>
        <ModalBody className="space-y-4">
          <FormField name="leave_date" label="Leave Date" required error={errors.leave_date}>
            <Input
              type="date"
              value={leaveDate}
              onChange={(event) => setLeaveDate(event.target.value)}
            />
          </FormField>
          <FormField name="leave_reason" label="Leave Reason" required error={errors.leave_reason}>
            <textarea
              value={leaveReason}
              onChange={(event) => setLeaveReason(event.target.value)}
              rows={4}
              maxLength={1000}
              placeholder="Describe the reason for your leave request"
              className="w-full rounded-xl border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[var(--color-brand-gold)]"
            />
          </FormField>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Submit Request
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
};

export default LeaveApplyModal;
