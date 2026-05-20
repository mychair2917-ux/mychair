import { CrossIcon } from '../../Icons';
import IconButton from '../IconButton';
import { useModalContext } from './ModalContext';

/**
Renders a circular icon button to close the modal, using context-provided props and handlers.

@function ModalCloseButton

@component
@returns {JSX.Element} - A React component rendering an icon button with a close (cross) SVG icon.

Usage:
- Intended to be used inside a Modal component.
- Retrieves behavior and styling via `useModalContext`.

Features:
- Uses `getModalCloseButtonProps` for accessibility and styling.
- Triggers the `onClose` function from modal context on click.

Note:
- Automatically styled as a full-radius icon button.
*/

function ModalCloseButton() {
  const { getModalCloseButtonProps, onClose } = useModalContext();
  const { className } = getModalCloseButtonProps();

  return (
    <IconButton className={className} radius="full" onClick={onClose}>
      <CrossIcon color="black" />
    </IconButton>
  );
}
ModalCloseButton.displayName = 'ModalCloseButton';
export default ModalCloseButton;
