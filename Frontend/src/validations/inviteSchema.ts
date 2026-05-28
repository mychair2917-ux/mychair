import * as Yup from 'yup';

import { INVITE_ROLES } from '../constants/invitation';

const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

const optionalPhone = Yup.string()
  .trim()
  .test('phone-format', 'Enter a valid phone number (7–15 digits, optional + prefix)', (value) => {
    if (!value) return true;
    return PHONE_REGEX.test(value);
  });

export interface InviteFormValues {
  role: string;
  full_name: string;
  email: string;
  phone: string;
  password: string;
  confirm_password: string;
  username: string;
  tenant_id: string;
  branch_name: string;
  reporting_manager_id: string;
  salon_name: string;
  salon_type: string;
  subscription_plan: string;
  salon_phone_number: string;
  address: string;
  gst_number: string;
}

export const defaultInviteFormValues: InviteFormValues = {
  role: '',
  full_name: '',
  email: '',
  phone: '',
  password: '',
  confirm_password: '',
  username: '',
  tenant_id: '',
  branch_name: '',
  reporting_manager_id: '',
  salon_name: '',
  salon_type: '',
  subscription_plan: '',
  salon_phone_number: '',
  address: '',
  gst_number: '',
};

/**
 * All roles now use email + password for login.
 * directPasswordSetup = owner/admin/manager inviting staff → password set immediately (no email invite).
 * Phone is always optional and used only as a contact field.
 */
export function buildInviteValidationSchema(
  selectedRole: string,
  requiresTenant: boolean,
  directPasswordSetup: boolean
): Yup.ObjectSchema<InviteFormValues> {
  const base: Record<string, Yup.AnySchema> = {
    role: Yup.string().required('Role is required').notOneOf([''], 'Please select a role'),
    full_name: Yup.string()
      .trim()
      .min(2, 'Full name must be at least 2 characters')
      .max(150)
      .required('Full name is required'),
    // Email is required for ALL roles
    email: Yup.string()
      .trim()
      .email('Enter a valid email address')
      .required('Email is required'),
    // Phone is always optional – used as contact only
    phone: optionalPhone,
    // Password fields only required when directly provisioning (owner invites staff/manager)
    password: directPasswordSetup
      ? Yup.string()
          .min(8, 'Password must be at least 8 characters')
          .required('Password is required')
      : Yup.string(),
    confirm_password: directPasswordSetup
      ? Yup.string()
          .oneOf([Yup.ref('password')], 'Passwords must match')
          .required('Please confirm the password')
      : Yup.string(),
    username: Yup.string().trim().max(100),
    tenant_id: requiresTenant
      ? Yup.string().required('Salon is required').notOneOf([''], 'Please select a salon')
      : Yup.string(),
    branch_name: Yup.string().trim().max(150),
    reporting_manager_id: Yup.string(),
    salon_name: Yup.string().trim().max(150),
    salon_type: Yup.string(),
    subscription_plan: Yup.string(),
    salon_phone_number: optionalPhone,
    address: Yup.string().trim().max(500),
    gst_number: Yup.string().trim().max(20),
  };

  if (selectedRole === INVITE_ROLES.SALON_OWNER) {
    base.salon_name = Yup.string()
      .trim()
      .min(2, 'Salon name is required')
      .max(150)
      .required('Salon name is required');
    base.salon_type = Yup.string().required('Salon type is required').notOneOf([''], 'Select salon type');
    base.subscription_plan = Yup.string()
      .required('Subscription plan is required')
      .notOneOf([''], 'Select subscription plan');
  }

  return Yup.object(base);
}
