import React, { useState } from 'react';

import { Button, FormField } from '../common';
import Modal from '../common/Modal';
import ModalBody from '../common/Modal/ModalBody';
import ModalFooter from '../common/Modal/ModalFooter';
import ModalHeader from '../common/Modal/ModalHeader';

interface LeaveRejectModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (rejectionReason: string) => Promise<void>;
  isLoading?: boolean;
  employeeName?: string;
}

const LeaveRejectModal: React.FC<LeaveRejectModalProps> = ({
  open,
  onClose,
  onConfirm,
  isLoading = false,
  employeeName,
}) => {
  const [rejectionReason, setRejectionReason] = useState('');

  const handleClose = () => {
    setRejectionReason('');
    onClose();
  };

  const handleConfirm = async () => {
    await onConfirm(rejectionReason.trim());
    handleClose();
  };

  return (
    <Modal open={open} onClose={handleClose} size="md" isShowIcon>
      <ModalHeader>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Reject Leave Request</h2>
          {employeeName && (
            <p className="mt-1 text-sm font-normal text-gray-500">
              {employeeName}&apos;s leave request
            </p>
          )}
        </div>
      </ModalHeader>
      <ModalBody className="space-y-4">
        <p className="text-sm text-gray-700">
          Are you sure you want to reject this leave request?
        </p>
        <FormField name="rejection_reason" label="Rejection Reason (optional)">
          <textarea
            value={rejectionReason}
            onChange={(event) => setRejectionReason(event.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Optional reason for the employee"
            className="w-full rounded-xl border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-[var(--color-brand-gold)]"
          />
        </FormField>
      </ModalBody>
      <ModalFooter>
        <Button type="button" variant="secondary" onClick={handleClose}>
          Cancel
        </Button>
        <Button type="button" variant="danger" isLoading={isLoading} onClick={handleConfirm}>
          Reject Leave
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default LeaveRejectModal;
