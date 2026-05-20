export interface ExpandableTextProps {
  text: string;
  className?: string;
  lineClamp?: number;
  expanded?: boolean;
  onToggle?: () => void;
  rowId?: string | number;
}
