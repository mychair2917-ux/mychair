export interface Open {
  kind: 'open';
}

export interface Closed {
  kind: 'closed';
}

export type OpenableState = Open | Closed;

export type OpenableAction = () => void;

export type OpenableStateResult = {
  isOpen: boolean;
  onOpen: OpenableAction;
  onClose: OpenableAction;
  onOpenChange: OpenableAction;
};
