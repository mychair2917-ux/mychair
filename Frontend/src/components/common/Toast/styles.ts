import { TOAST_TYPES } from '../../../constants';
import { IconColor, IconSize } from '../SvgIcon/Types';
import { TypographyColor } from '../Typography/Types';

export const toastTypeStyles: Record<string, string> = {
  [TOAST_TYPES.DEFAULT]: 'bg-gray-100 text-gray-800',
  [TOAST_TYPES.SUCCESS]: 'text-white',
  [TOAST_TYPES.OUTLINED_SUCCESS]: 'border border-green-500 bg-green-50 text-black',
  [TOAST_TYPES.ERROR]: 'bg-red-500 text-white',
  [TOAST_TYPES.OUTLINED_ERROR]: 'border border-red-500 bg-red-50 text-red-500',
  [TOAST_TYPES.WARNING]: 'bg-yellow-400 text-white',
  [TOAST_TYPES.OUTLINED_WARNING]: 'border border-yellow-400 bg-yellow-50 text-yellow-400',
  [TOAST_TYPES.OUTLINED_NOTICE]: 'border border-orange-500 bg-orange-600 text-orange-500',
  [TOAST_TYPES.INFO]: 'bg-blue-500 text-white',
  [TOAST_TYPES.OUTLINED_INFO]: 'border border-blue-500 bg-blue-50 text-black',
  [TOAST_TYPES.NOTIFICATION]: 'bg-[linear-gradient(29deg,#3131F5_0.03%,#0D8BFD_57.66%)] text-white',
  [TOAST_TYPES.NOTIFICATION_SUCCESS]:
    'bg-[linear-gradient(29deg,#3131F5_0.03%,#0D8BFD_57.66%)] text-white',
  [TOAST_TYPES.NOTIFICATION_ERROR]: 'border border-red-500 bg-red-300 text-red-500',
};

export const buttonColorMapping: Record<string, string> = {
  [TOAST_TYPES.OUTLINED_SUCCESS]: 'text-green-500',
  [TOAST_TYPES.OUTLINED_ERROR]: 'text-red-500',
  [TOAST_TYPES.OUTLINED_INFO]: 'text-blue-500',
  [TOAST_TYPES.OUTLINED_WARNING]: 'text-yellow-500',
  [TOAST_TYPES.OUTLINED_NOTICE]: 'text-orange-500',
  [TOAST_TYPES.DEFAULT]: 'text-gray-700',
  [TOAST_TYPES.NOTIFICATION_ERROR]: 'text-red-400',
};

export const outlinedTypes = new Set<string>([
  TOAST_TYPES.OUTLINED_SUCCESS,
  TOAST_TYPES.OUTLINED_ERROR,
  TOAST_TYPES.OUTLINED_INFO,
  TOAST_TYPES.OUTLINED_WARNING,
  TOAST_TYPES.OUTLINED_NOTICE,
  TOAST_TYPES.DEFAULT,
]);

export const NotificationOutlinedTypes = new Set<string>([
  TOAST_TYPES.NOTIFICATION,
  TOAST_TYPES.NOTIFICATION_ERROR,
  TOAST_TYPES.NOTIFICATION_SUCCESS,
]);

export const borderColorMapping: Record<string, string> = {
  [TOAST_TYPES.OUTLINED_SUCCESS]: 'border-green-500',
  [TOAST_TYPES.NOTIFICATION_ERROR]: 'border-red-500 text-red-400',
  [TOAST_TYPES.OUTLINED_INFO]: 'border-blue-500',
  [TOAST_TYPES.OUTLINED_WARNING]: 'border-yellow-500',
  [TOAST_TYPES.OUTLINED_NOTICE]: 'border-orange-500',
  [TOAST_TYPES.DEFAULT]: 'border-gray-400',
};

export const actionLabelColorMapping: Record<string, string> = {
  [TOAST_TYPES.OUTLINED_SUCCESS]: 'text-white',
  [TOAST_TYPES.NOTIFICATION_ERROR]: 'text-red-400',
  [TOAST_TYPES.OUTLINED_INFO]: 'text-white',
  [TOAST_TYPES.OUTLINED_WARNING]: 'text-white',
  [TOAST_TYPES.OUTLINED_NOTICE]: 'text-orange-500',
  [TOAST_TYPES.DEFAULT]: 'text-white',
  [TOAST_TYPES.SUCCESS]: 'text-white',
  [TOAST_TYPES.ERROR]: 'text-red-400',
  [TOAST_TYPES.OUTLINED_ERROR]: 'text-red-400',
  [TOAST_TYPES.WARNING]: 'text-red-400',
  [TOAST_TYPES.INFO]: 'text-yellow-500',
  [TOAST_TYPES.NOTIFICATION]: 'text-white',
  [TOAST_TYPES.NOTIFICATION_SUCCESS]: 'text-white',
};

export const customIconStyleMapping: Record<string, { color: IconColor; size: IconSize }> = {
  [TOAST_TYPES.SUCCESS]: { color: 'white', size: 'xl' },
  [TOAST_TYPES.OUTLINED_SUCCESS]: { color: 'green', size: 'lg' },
  [TOAST_TYPES.ERROR]: { color: 'white', size: 'lg' },
  [TOAST_TYPES.OUTLINED_ERROR]: { color: 'red', size: 'lg' },
  [TOAST_TYPES.WARNING]: { color: 'white', size: 'lg' },
  [TOAST_TYPES.OUTLINED_WARNING]: { color: 'yellow', size: 'lg' },
  [TOAST_TYPES.OUTLINED_NOTICE]: { color: 'orange', size: 'lg' },
  [TOAST_TYPES.INFO]: { color: 'white', size: 'lg' },
  [TOAST_TYPES.OUTLINED_INFO]: { color: 'blue', size: 'lg' },
  [TOAST_TYPES.DEFAULT]: { color: 'gray', size: 'md' },
  [TOAST_TYPES.NOTIFICATION]: { color: 'white', size: 'md' },
  [TOAST_TYPES.NOTIFICATION_SUCCESS]: { color: 'white', size: 'md' },
  [TOAST_TYPES.NOTIFICATION_ERROR]: { color: 'red', size: 'md' },
};

export const nonDismissableColorMapping: Record<string, TypographyColor> = {
  [TOAST_TYPES.OUTLINED_WARNING]: 'yellow',
  [TOAST_TYPES.OUTLINED_ERROR]: 'red',
  [TOAST_TYPES.OUTLINED_INFO]: 'blue',
  [TOAST_TYPES.OUTLINED_NOTICE]: 'orange-500',
  [TOAST_TYPES.DEFAULT]: 'gray',
  [TOAST_TYPES.NOTIFICATION_ERROR]: 'red',
};
