import * as Yup from 'yup';

const PHONE_REGEX = /^\+?[0-9]{7,15}$/;

const optionalPhone = Yup.string()
  .trim()
  .test('phone-format', 'Enter a valid phone number (7–15 digits, optional + prefix)', (value) => {
    if (!value) return true;
    return PHONE_REGEX.test(value);
  });

export const InvitationSchema = Yup.object({
  salon_name: Yup.string()
    .trim()
    .min(2, 'Salon name must be at least 2 characters')
    .max(150, 'Salon name must be at most 150 characters')
    .required('Salon name is required'),
  owner_full_name: Yup.string()
    .trim()
    .min(2, 'Owner full name must be at least 2 characters')
    .max(150, 'Owner full name must be at most 150 characters')
    .required('Owner full name is required'),
  email: Yup.string()
    .trim()
    .email('Enter a valid email address')
    .required('Owner email is required'),
  owner_phone_number: optionalPhone,
  salon_phone_number: optionalPhone,
  salon_type: Yup.string()
    .trim()
    .required('Salon type is required')
    .notOneOf([''], 'Please select a salon type'),
  branch_name: Yup.string().trim().max(150, 'Branch name must be at most 150 characters'),
  address: Yup.string().trim().max(500, 'Address must be at most 500 characters'),
  subscription_plan: Yup.string()
    .trim()
    .required('Subscription plan is required')
    .notOneOf([''], 'Please select a subscription plan'),
});

export const CreatePasswordSchema = Yup.object({
  password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .required('Password is required'),
  confirm_password: Yup.string()
    .oneOf([Yup.ref('password')], 'Passwords must match')
    .required('Confirm password is required'),
});

export const SalonOwnerLoginSchema = Yup.object({
  email: Yup.string().trim().email('Enter a valid email').required('Email is required'),
  password: Yup.string().required('Password is required'),
});
