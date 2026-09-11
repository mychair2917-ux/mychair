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

import { cn } from '../../../utils/cn';
import ModalCloseButton from './ModalCloseButton';
import { useModalContext } from './ModalContext';
import { ModalContentProps } from './Types';

/**
  Renders the modal content using a floating UI approach for accessibility and interaction management.
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

  const modalProps = getModalProps();

  return (
    <FloatingPortal>
      <FloatingOverlay className="relative z-50 grid place-items-center bg-black/60 p-3 sm:p-6 overflow-y-auto" lockScroll>
        <FloatingFocusManager context={context} initialFocus={refs.floating}>
          <div
            ref={handleElementRef}
            {...modalProps}
            {...getFloatingProps()}
            className={cn(
              modalProps.className,
              'max-h-[90dvh] max-h-[90vh] overflow-y-auto custom-scrollbar'
            )}
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
