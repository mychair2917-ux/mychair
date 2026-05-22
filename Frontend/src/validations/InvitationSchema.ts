import * as Yup from 'yup';

export const InvitationSchema = Yup.object({
  salon_name: Yup.string()
    .trim()
    .min(2, 'Salon name must be at least 2 characters')
    .max(150, 'Salon name must be at most 150 characters')
    .required('Salon name is required'),
  slug: Yup.string()
    .trim()
    .min(2, 'Slug must be at least 2 characters')
    .max(100, 'Slug must be at most 100 characters')
    .matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase letters, numbers, and hyphens only')
    .required('Slug is required'),
  email: Yup.string().trim().email('Enter a valid email').required('Email is required'),
  username: Yup.string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(100, 'Username must be at most 100 characters')
    .required('Username is required'),
  address: Yup.string().trim().max(500, 'Address must be at most 500 characters'),
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
