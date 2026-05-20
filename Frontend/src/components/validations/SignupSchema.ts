import * as Yup from 'yup';

export const SignUpSchema = Yup.object().shape({
  new_password: Yup.string()
    .min(8, 'Password must be at least 8 characters')
    .required('Password is required'),
  confirm_new_password: Yup.string()
    .oneOf([Yup.ref('new_password')], 'Passwords must match')
    .required('Please confirm your password'),
});
