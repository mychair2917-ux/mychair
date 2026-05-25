import { ApiErrorResponse } from '../redux/slices/api/Types';

const FIELD_FALLBACK_MESSAGE = 'This field is invalid. Please check your input.';
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

type RtkQueryError = {
  data?: ApiErrorResponse;
  status?: number;
};

export const getFieldErrorMessage = (messages?: string[] | null): string => {
  const message = messages?.find((item) => item?.trim())?.trim();
  return message || FIELD_FALLBACK_MESSAGE;
};

export const getApiErrorMessage = (
  err: unknown,
  fallback = GENERIC_ERROR_MESSAGE
): string => {
  const apiError = err as RtkQueryError;
  const message = apiError?.data?.message?.trim();
  if (message) return message;

  const fieldErrors = apiError?.data?.errors;
  if (fieldErrors) {
    const firstFieldMessage = Object.values(fieldErrors)
      .flat()
      .find((item) => item?.trim());
    if (firstFieldMessage?.trim()) return firstFieldMessage.trim();
  }

  return fallback;
};

export const applyApiFieldErrors = (
  errors: Record<string, string[]> | null | undefined,
  setFieldError: (field: string, message: string) => void
): boolean => {
  if (!errors || Object.keys(errors).length === 0) return false;

  Object.entries(errors).forEach(([field, messages]) => {
    setFieldError(field, getFieldErrorMessage(messages));
  });

  return true;
};
