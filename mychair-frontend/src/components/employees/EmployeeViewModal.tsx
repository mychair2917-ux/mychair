import React from 'react';

import Modal from '../common/Modal';
import ModalBody from '../common/Modal/ModalBody';
import ModalHeader from '../common/Modal/ModalHeader';
import { EmployeeListItem } from '../../redux/slices/employees/Types';
import { EMPLOYEE_ROLE_LABELS } from '../../constants/employees';

interface EmployeeViewModalProps {
  open: boolean;
  employee: EmployeeListItem | null;
  onClose: () => void;
}

const EmployeeViewModal: React.FC<EmployeeViewModalProps> = ({ open, employee, onClose }) => {
  if (!employee) return null;

  return (
    <Modal open={open} onClose={onClose} size="lg">
      <ModalHeader>Employee details</ModalHeader>
      <ModalBody>
        <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-gray-500">Full name</dt>
            <dd className="font-medium text-gray-900">{employee.full_name}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Role</dt>
            <dd className="font-medium text-gray-900">
              {EMPLOYEE_ROLE_LABELS[employee.role] ?? employee.role}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Email</dt>
            <dd className="font-medium text-gray-900">{employee.email}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Phone</dt>
            <dd className="font-medium text-gray-900">{employee.phone || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Branch</dt>
            <dd className="font-medium text-gray-900">{employee.branch_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Status</dt>
            <dd className="font-medium capitalize text-gray-900">
              {employee.status.toLowerCase()}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-gray-500">Created</dt>
            <dd className="font-medium text-gray-900">
              {new Date(employee.created_at).toLocaleString()}
            </dd>
          </div>
        </dl>
      </ModalBody>
    </Modal>
  );
};

export default EmployeeViewModal;
