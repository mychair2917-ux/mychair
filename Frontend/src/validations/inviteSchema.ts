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
  // Salary configuration (manager & staff)
  salary: string;
  salary_type: string;
  joining_date: string;
  incentive_base: boolean;
  service_incentive_percent: string;
  product_incentive_percent: string;
  latitude: number;
  longitude: number;
  attendance_radius: number;
  shift_start: string;
  weekly_off: string[];
}

const todayIso = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
  salary: '',
  salary_type: 'monthly',
  joining_date: todayIso(),
  incentive_base: false,
  service_incentive_percent: '',
  product_incentive_percent: '',
  latitude: 28.6139,
  longitude: 77.209,
  attendance_radius: 100,
  shift_start: '09:00',
  weekly_off: [],
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
    // Salary fields — validated only for manager/staff roles below
    salary: Yup.string(),
    salary_type: Yup.string(),
    joining_date: Yup.string(),
    incentive_base: Yup.boolean(),
    service_incentive_percent: Yup.string(),
    product_incentive_percent: Yup.string(),
    latitude: Yup.number(),
    longitude: Yup.number(),
    attendance_radius: Yup.number(),
    shift_start: Yup.string(),
    weekly_off: Yup.array().of(Yup.string()),
  };

  const isTeamRole =
    selectedRole === INVITE_ROLES.MANAGER || selectedRole === INVITE_ROLES.STAFF;

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
    base.latitude = Yup.number()
      .min(-90)
      .max(90)
      .required('Salon location is required');
    base.longitude = Yup.number()
      .min(-180)
      .max(180)
      .required('Salon location is required');
    base.attendance_radius = Yup.number()
      .min(10, 'Minimum radius is 10 meters')
      .max(5000, 'Maximum radius is 5000 meters')
      .required('Attendance radius is required');
    base.shift_start = Yup.string()
      .matches(/^\d{2}:\d{2}$/, 'Enter shift start as HH:MM')
      .required('Shift start is required');
  }

  if (isTeamRole) {
    const percentSchema = (label: string) =>
      Yup.string()
        .required(`${label} is required`)
        .test('is-percent', 'Enter a percentage between 0 and 100', (value) => {
          if (value === undefined || value === '') return false;
          const num = Number(value);
          return Number.isFinite(num) && num >= 0 && num <= 100;
        });

    base.salary = Yup.string()
      .required('Salary is required')
      .test('is-positive-number', 'Enter a valid salary amount', (value) => {
        if (value === undefined || value === '') return false;
        const num = Number(value);
        return Number.isFinite(num) && num >= 0;
      });
    base.salary_type = Yup.string()
      .required('Salary type is required')
      .notOneOf([''], 'Select salary type');
    base.joining_date = Yup.string().required('Joining date is required');
    base.incentive_base = Yup.boolean();
    base.service_incentive_percent = Yup.string().when('incentive_base', {
      is: true,
      then: () => percentSchema('Service incentive %'),
      otherwise: (schema) => schema,
    });
    base.product_incentive_percent = Yup.string().when('incentive_base', {
      is: true,
      then: () => percentSchema('Product incentive %'),
      otherwise: (schema) => schema,
    });
  }

  return Yup.object(base);
}
