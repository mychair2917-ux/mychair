import React, { useEffect, useRef, useState } from 'react';

import { TOAST_TYPES } from '../../../constants';
import { useAppSelector } from '../../../redux/hooks';
import {
  AlertTriangleIcon,
  ClockIcon,
  InfoIcon,
  NotificationBellIcon,
  TickIcon,
} from '../../Icons';
import CrossIcon from '../../Icons/CrossIcon';
import Typography from '../Typography';
import {
  actionLabelColorMapping,
  borderColorMapping,
  buttonColorMapping,
  customIconStyleMapping,
  nonDismissableColorMapping,
  NotificationOutlinedTypes,
  outlinedTypes,
  toastTypeStyles,
} from './styles';
import { ToastProps } from './Types';

const iconMapping: Record<string, React.ReactNode> = {
  [TOAST_TYPES.SUCCESS]: <TickIcon viewBox="0 0 21 21" color="white" size="xl" />,
  [TOAST_TYPES.OUTLINED_SUCCESS]: <TickIcon viewBox="0 0 26 26" color="green" />,
  [TOAST_TYPES.ERROR]: <InfoIcon viewBox="0 0 26 26" color="white" />,
  [TOAST_TYPES.OUTLINED_ERROR]: <InfoIcon viewBox="0 0 26 26" color="red" />,
  [TOAST_TYPES.WARNING]: <InfoIcon viewBox="0 0 26 26" color="white" />,
  [TOAST_TYPES.OUTLINED_WARNING]: <InfoIcon viewBox="0 0 26 26" color="yellow" />,
  [TOAST_TYPES.OUTLINED_NOTICE]: <AlertTriangleIcon size="md" color="orange" />,
  [TOAST_TYPES.INFO]: <InfoIcon viewBox="0 0 26 26" color="white" />,
  [TOAST_TYPES.OUTLINED_INFO]: <InfoIcon viewBox="0 0 26 26" color="cobalt-blue" />,
  [TOAST_TYPES.DEFAULT]: <InfoIcon viewBox="0 0 26 26" color="charcoal-gray" />,
  [TOAST_TYPES.NOTIFICATION]: <NotificationBellIcon size="md" color="white" />,
  [TOAST_TYPES.NOTIFICATION_SUCCESS]: <ClockIcon size="md" color="white" />,
  [TOAST_TYPES.NOTIFICATION_ERROR]: <AlertTriangleIcon size="md" color="red" />,
};

/** Renders an animated toast notification component with customizable styles, icons, and optional actions.
This component supports multiple toast types like success, error, warning, info, and their outlined variants, with auto-dismiss and manual close functionality.
Parameters:
@param {ToastProps} props - Props object configuring the toast behavior and appearance.
@param {string} props.id - Unique identifier for the toast instance.
@param {string} props.message - The main message to be displayed in the toast.
@param {string} [props.type='default'] - The style variant of the toast, defined by TOAST_TYPES.
@param {string} [props.buttonLabel] - Optional label for an action button displayed next to the message.
@param {function} [props.onButtonClick] - Optional callback for the action button.
@param {function} props.onClose - Callback function called when the toast is dismissed or closed.
@param {number} [props.duration=2000] - Duration in milliseconds before the toast auto-dismisses. Set to 0 to disable auto-dismiss.
@param {React.ElementType} [props.Icon] - Optional custom icon component to override the default icon for the toast type.
Returns:
@returns {JSX.Element} - A React component rendering an interactive, animated toast notification.
Exception Handling:
None
*/
const Toast = ({
  id,
  message,
  type = 'default',
  buttonLabel,
  onButtonClick,
  onClose,
  duration = 3000,
  Icon,
  action,
  handleToastNavigation,
  isNonDismissable = false,
}: ToastProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const user = localStorage.getItem('user_info');
  const orgId = useAppSelector((state) => state.selectedOrganization.selectedOrganization?.id);
  const prevOrgIdRef = useRef<string | null | undefined>(null);

  useEffect(() => {
    // Trigger entrance animation
    const enterTimeout = setTimeout(() => setIsVisible(true), 10);

    // Skip auto-dismiss if data retention is enabled
    let exitTimeout: number | undefined;
    if (!isNonDismissable && duration > 0) {
      exitTimeout = window.setTimeout(() => handleClose(), duration);
    }
    if (user === null) {
      exitTimeout = window.setTimeout(() => handleClose(), duration);
    }

    return () => {
      clearTimeout(enterTimeout);
      if (exitTimeout) clearTimeout(exitTimeout);
    };
  }, [duration, id, onClose, isNonDismissable, user]);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), 3000); // match transition duration (was 3000ms earlier, likely too long)
  };

  useEffect(() => {
    if (isNonDismissable) {
      const enterTimeout = setTimeout(() => setIsVisible(true), 10);
      let exitTimeout: number | undefined;

      // Check if orgId has actually changed
      if (orgId !== null && prevOrgIdRef.current !== null && prevOrgIdRef.current !== orgId) {
        exitTimeout = window.setTimeout(() => handleClose(), duration);
      }

      // Update the ref with the new orgId
      prevOrgIdRef.current = orgId;

      return () => {
        clearTimeout(enterTimeout);
        if (exitTimeout) clearTimeout(exitTimeout);
      };
    }
  }, [orgId]);

  const isOutlined = outlinedTypes.has(type);
  const isCrossIcon = NotificationOutlinedTypes.has(type);
  const buttonColor = buttonColorMapping[type] ?? 'text-white';
  const actionLabelColor = actionLabelColorMapping[type] ?? 'text-white';
  const style = toastTypeStyles[type] || toastTypeStyles['default'];

  // Common transition classes
  const transitionClasses = `transform transition-all duration-300 ease-in-out ${
    isVisible && !isExiting
      ? 'translate-x-0 opacity-100'
      : isExiting
        ? 'translate-x-full opacity-0'
        : 'translate-x-full opacity-0'
  }`;

  const handleQueryNavigation = () => {
    if (handleToastNavigation) {
      handleToastNavigation();
    }
    setIsExiting(true);
    setTimeout(() => onClose(id), 3000); // match transition duration (was 3000ms earlier, likely too long)
  };

  return (
    <div
      className={`relative flex w-full max-w-sm items-center justify-between gap-3 rounded-lg px-4 py-3 shadow-lg ${style} ${transitionClasses}`}
      style={
        type === TOAST_TYPES.SUCCESS
          ? {
              background:
                'linear-gradient(29deg, var(--color-blue-50) 0.03%, var(--color-blue-400) 57.66%)',
            }
          : undefined
      }
    >
      {Icon ? (
        <Icon {...customIconStyleMapping[type]} />
      ) : (
        iconMapping[type] || iconMapping['default']
      )}
      <span className={`h-[100%] flex-1 overflow-hidden text-base break-words text-ellipsis`}>
        {message}
      </span>
      {buttonLabel && (
        <button
          onClick={onButtonClick}
          className={`ml-2 cursor-pointer text-sm font-bold ${buttonColor}`}
        >
          {buttonLabel}
        </button>
      )}
      {action && (
        <>
          <div
            className={`w-px border ${borderColorMapping[type] || 'border-white'} border`}
            style={{ height: '80%' }}
          />
          <div
            className={`cursor-pointer ${actionLabelColor}`}
            color={actionLabelColor}
            onClick={action.onClick}
          >
            {action.label}
          </div>
        </>
      )}
      {!isNonDismissable && (
        <>
          {isOutlined ? (
            <button onClick={handleClose} className={`ml-2 cursor-pointer text-lg ${buttonColor}`}>
              x
            </button>
          ) : (
            <></>
          )}
        </>
      )}
      {!isNonDismissable && (
        <>
          {isCrossIcon ? (
            <button
              onClick={handleClose}
              className="absolute top-0 right-2 ml-2 cursor-pointer text-lg"
            >
              <CrossIcon color={type === TOAST_TYPES.DEFAULT ? 'gray' : 'white'} size="md" />
            </button>
          ) : (
            <button onClick={handleClose} className="t-0 top-0 right-2 ml-2 cursor-pointer">
              <CrossIcon color={type === TOAST_TYPES.DEFAULT ? 'gray' : 'white'} size="lg" />
            </button>
          )}
        </>
      )}
      {isNonDismissable && (
        <div className="align-center flex gap-4">
          <Typography color={nonDismissableColorMapping[type] ?? 'red'}>|</Typography>

          <Typography
            color={nonDismissableColorMapping[type] ?? 'red'}
            onClick={handleQueryNavigation}
            className="!cursor-pointer"
          >
            View
          </Typography>
        </div>
      )}
    </div>
  );
};

export default Toast;
