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

const EXIT_ANIMATION_MS = 300;

const iconMapping: Record<string, React.ReactNode> = {
  [TOAST_TYPES.SUCCESS]: <TickIcon viewBox="0 0 21 21" color="white" size="lg" />,
  [TOAST_TYPES.OUTLINED_SUCCESS]: <TickIcon viewBox="0 0 26 26" color="green" />,
  [TOAST_TYPES.ERROR]: <AlertTriangleIcon size="md" color="white" />,
  [TOAST_TYPES.OUTLINED_ERROR]: <AlertTriangleIcon size="md" color="red" />,
  [TOAST_TYPES.WARNING]: <AlertTriangleIcon size="md" color="white" />,
  [TOAST_TYPES.OUTLINED_WARNING]: <AlertTriangleIcon size="md" color="yellow" />,
  [TOAST_TYPES.OUTLINED_NOTICE]: <AlertTriangleIcon size="md" color="orange" />,
  [TOAST_TYPES.INFO]: <InfoIcon viewBox="0 0 26 26" color="white" />,
  [TOAST_TYPES.OUTLINED_INFO]: <InfoIcon viewBox="0 0 26 26" color="cobalt-blue" />,
  [TOAST_TYPES.DEFAULT]: <InfoIcon viewBox="0 0 26 26" color="charcoal-gray" />,
  [TOAST_TYPES.NOTIFICATION]: <NotificationBellIcon size="md" color="white" />,
  [TOAST_TYPES.NOTIFICATION_SUCCESS]: <ClockIcon size="md" color="white" />,
  [TOAST_TYPES.NOTIFICATION_ERROR]: <AlertTriangleIcon size="md" color="red" />,
};

const Toast = ({
  id,
  message,
  type = 'default',
  buttonLabel,
  onButtonClick,
  onClose,
  duration = 5000,
  Icon,
  action,
  handleToastNavigation,
  isNonDismissable = false,
}: ToastProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const user = localStorage.getItem('user_info');
  const orgId = useAppSelector((state) => state.auth.orgId);
  const prevOrgIdRef = useRef<string | null | undefined>(null);

  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => onClose(id), EXIT_ANIMATION_MS);
  };

  useEffect(() => {
    const enterTimeout = setTimeout(() => setIsVisible(true), 10);

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
  }, [duration, id, isNonDismissable, user]);

  useEffect(() => {
    if (isNonDismissable) {
      const enterTimeout = setTimeout(() => setIsVisible(true), 10);
      let exitTimeout: number | undefined;

      if (orgId !== null && prevOrgIdRef.current !== null && prevOrgIdRef.current !== orgId) {
        exitTimeout = window.setTimeout(() => handleClose(), duration);
      }

      prevOrgIdRef.current = orgId;

      return () => {
        clearTimeout(enterTimeout);
        if (exitTimeout) clearTimeout(exitTimeout);
      };
    }
  }, [orgId, duration, isNonDismissable]);

  const isOutlined = outlinedTypes.has(type);
  const isCrossIcon = NotificationOutlinedTypes.has(type);
  const buttonColor = buttonColorMapping[type] ?? 'text-white';
  const actionLabelColor = actionLabelColorMapping[type] ?? 'text-white';
  const style = toastTypeStyles[type] || toastTypeStyles['default'];

  const transitionClasses = `transform transition-all duration-300 ease-in-out ${
    isVisible && !isExiting
      ? 'translate-x-0 opacity-100'
      : 'translate-x-4 opacity-0'
  }`;

  const handleQueryNavigation = () => {
    if (handleToastNavigation) {
      handleToastNavigation();
    }
    handleClose();
  };

  const closeIconColor = type === TOAST_TYPES.DEFAULT ? 'gray' : 'white';

  return (
    <div
      className={`relative flex w-full items-start justify-between gap-3 rounded-xl px-4 py-3 shadow-lg ${style} ${transitionClasses}`}
      role="alert"
      aria-atomic="true"
    >
      <div className="mt-0.5 flex-shrink-0">
        {Icon ? <Icon {...customIconStyleMapping[type]} /> : iconMapping[type] || iconMapping['default']}
      </div>
      <p className="flex-1 pt-0.5 text-sm leading-snug font-medium break-words">{message}</p>
      {buttonLabel && (
        <button
          type="button"
          onClick={onButtonClick}
          className={`cursor-pointer text-sm font-semibold ${buttonColor}`}
        >
          {buttonLabel}
        </button>
      )}
      {action && (
        <>
          <div
            className={`w-px border ${borderColorMapping[type] || 'border-white/40'}`}
            style={{ height: '80%' }}
          />
          <button
            type="button"
            className={`cursor-pointer text-sm font-semibold ${actionLabelColor}`}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        </>
      )}
      {!isNonDismissable && (
        <button
          type="button"
          onClick={handleClose}
          className={`ml-1 flex-shrink-0 cursor-pointer rounded-md p-0.5 transition-opacity hover:opacity-80 ${isOutlined ? buttonColor : ''}`}
          aria-label="Dismiss notification"
        >
          {isOutlined && !isCrossIcon ? (
            <span className={`text-lg leading-none ${buttonColor}`}>×</span>
          ) : (
            <CrossIcon color={closeIconColor} size={isCrossIcon ? 'md' : 'lg'} />
          )}
        </button>
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
