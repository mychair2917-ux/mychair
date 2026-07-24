import { useState } from 'react';
import { useId } from '@floating-ui/react';

import { cn } from '../../../utils/cn';
import { fromNullable } from '../../../utils/fp-utils';
import { ModalProps, modalSizeClassNameMapping } from './Types';

/**
  A custom hook for managing modal state and behavior.
  
  This hook provides configuration options for controlling modal visibility, size, escape key behavior, and outside press behavior.
  It also includes methods for applying accessibility attributes and styling.
  
  @function useModal
  
  @param {Object} props - The props for the useModal hook.
  @param {boolean} [props.open=false] - Controls whether the modal is open.
  @param {string} [props.size='md'] - Sets the size of the modal. Can be any key from `modalSizeClassNameMapping`.
  @param {boolean} [props.escapeKey=true] - Determines whether the modal should close when the escape key is pressed.
  @param {boolean} [props.outsidePress=false] - Determines whether the modal should close when clicked outside.
  @param {function} [props.onClose] - A callback function triggered when the modal closes.
  @param {React.RefObject<HTMLElement|null>} [props.ref] - A ref for the modal element.
  @param {string} [props.className] - Additional class names to apply to the modal.
  @param {Object} [props.classNames] - Custom class names for specific modal elements (e.g., close button).
  
  @returns {Object} - An object containing various properties and methods to control modal behavior:
    - `open`: The current modal open state.
    - `headerId`: The ID for the modal header.
    - `bodyId`: The ID for the modal body.
    - `getModalProps`: Returns props for the modal container, including accessibility attributes and styling.
    - `getModalCloseButtonProps`: Returns props for the close button, including styling.
    - `setHeaderStatus`: A setter function to control the header status.
    - `setBodyStatus`: A setter function to control the body status.
    - `onClose`: The provided onClose callback function.
  
  Usage:
  - The `useModal` hook is designed to manage modal-related behavior and properties.
  - Use the returned methods and props to customize modal functionality, such as controlling visibility and appearance.
  
  Features:
  - Supports customizable modal behavior with `escapeKey` and `outsidePress` options.
  - Provides a method to manage the modal close button and ARIA attributes.
  - Allows customizable styling through `className` and `classNames`.
 */

interface UseModalProps extends ModalProps {
  ref?:
    | React.RefObject<HTMLElement | null>
    | React.RefObject<HTMLElement | null>
    | React.Ref<HTMLElement | null>;
}

export function useModal({
  ref,
  open = false,
  className,
  classNames,
  size = 'md',
  escapeKey = true,
  outsidePress = true,
  onClose,
  isShowIcon = false,
}: UseModalProps) {
  const headerId = useId();
  const bodyId = useId();

  const [headerStatus, setHeaderStatus] = useState<'mounted' | 'unmounted'>('unmounted');
  const [bodyStatus, setBodyStatus] = useState<'mounted' | 'unmounted'>('unmounted');

  const getModalProps = () => ({
    'aria-modal': true,
    'aria-labelledby': headerStatus === 'mounted' ? headerId : undefined,
    'aria-describedby': bodyStatus === 'mounted' ? bodyId : undefined,
    className: cn(
      'relative box-border bg-white w-full z-50',
      'flex flex-col',
      'max-h-[min(100dvh-1.5rem,100%)] overflow-y-auto',
      'rounded sm:rounded-md',
      '!shadow-popover !outline-0',
      modalSizeClassNameMapping[size],
      className
    ),
  });

  const getModalCloseButtonProps = () => ({
    className: cn(
      'absolute right-5 top-5 cursor-pointer p-1 text-gray-600',
      fromNullable(classNames)
        .map((closeButton) => closeButton.closeButton)
        .getOrElseValue('')
    ),
  });

  return {
    ref,
    open,
    headerId,
    bodyId,
    escapeKey,
    outsidePress,
    setHeaderStatus,
    setBodyStatus,
    getModalProps,
    getModalCloseButtonProps,
    onClose,
    isShowIcon,
  };
}
