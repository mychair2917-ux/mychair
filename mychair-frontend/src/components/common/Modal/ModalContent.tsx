import {
  FloatingFocusManager,
  FloatingOverlay,
  FloatingPortal,
  useClick,
  useDismiss,
  useFloating,
  useInteractions,
  useMergeRefs,
  useRole,
} from '@floating-ui/react';

import ModalCloseButton from './ModalCloseButton';
import { useModalContext } from './ModalContext';
import { ModalContentProps } from './Types';

/**
  Renders the modal content using a floating UI approach for accessibility and interaction management.

  This component uses a portal to render the modal outside the main DOM tree, applies a background overlay, 
  and provides keyboard and click-based dismiss functionality. It supports escape key handling, outside click 
  dismissal, focus trapping, and includes an optional close button icon.

  Parameters:
  @param {ModalContentProps} props - Props passed to control modal behavior, including:
    - `children` (ReactNode): Content to be displayed inside the modal.
    - `open` (boolean): Controls whether the modal is visible.
    - `escapeKey` (boolean): Enables modal dismissal with the Escape key.
    - `outsidePress` (boolean): Enables modal dismissal when clicking outside.
    - `onClose` (function): Callback to close the modal.
    - `getModalProps` (function): Function to apply necessary accessibility props.
    - `isShowIcon` (boolean): Determines if the close button is shown.
    - `ref` (Ref): Reference to the modal element.

  Returns:
  @returns {ReactElement} - A portal-rendered floating modal with accessibility and interaction features.

  Exception Handling:
  Does not render anything if `open` is false.
*/

const ModalContent: React.FC<ModalContentProps> = ({ children }) => {
  const { ref, open, escapeKey, outsidePress, onClose, getModalProps, isShowIcon } =
    useModalContext();

  const { refs, context } = useFloating<HTMLElement>({
    open,
    onOpenChange: onClose,
  });

  const { getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context, { escapeKey, outsidePress }),
    useRole(context),
  ]);

  const handleElementRef = useMergeRefs([refs.setFloating, ref]);


  if (!open) return null;

  return (
    <FloatingPortal>
      <FloatingOverlay className="relative z-50 grid place-items-center bg-black/60" lockScroll>
        <FloatingFocusManager context={context} initialFocus={refs.floating}>
          <div
            ref={handleElementRef}
            {...getModalProps()}
            {...getFloatingProps()}
            onClick={(e) => e.stopPropagation()}
          >
            {isShowIcon && <ModalCloseButton />}
            {children}
          </div>
        </FloatingFocusManager>
      </FloatingOverlay>
    </FloatingPortal>
  );
};

export default ModalContent;
