import * as Yup from 'yup';

const strictEmailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

//  Validation schema for the personal info form fields.
export const personalInfoSchema = Yup.object({
  firstName: Yup.string()
    .trim()
    .matches(/^(?!\s*$).+/, 'First name cannot be blank')
    .required('First name is required'),
  lastName: Yup.string()
    .trim()
    .matches(/^(?!\s*$).+/, 'Last name cannot be blank')
    .required('Last name is required'),
  email: Yup.string()
    .trim()
    .matches(/^(?!\s*$).+/, 'Email cannot be blank')
    .matches(strictEmailRegex, 'Enter a valid email address')
    .required('Email is required'),
  jobTitle: Yup.string()
    .trim()
    .matches(/^(?!\s*$).+/, 'Job title cannot be blank')
    .required('Job title is required'),
});

// Validation Schema for  preferred Email
export const preferredEmailSchema = Yup.object({
  preferredEmail: Yup.string()
    .trim()
    .matches(/^(?!\s*$).+/, 'Email cannot be blank')
    .matches(strictEmailRegex, 'Enter a valid email address')
    .email('Please enter a valid email address')
    .required('Email is required'),
});
