import { SvgIconProps } from '../SvgIcon/Types';

export interface ErrorPageProps {
  Icon?: React.ComponentType<SvgIconProps>;
  title?: string;
  description?: string;
  errorDescription?: string;
  buttonLabel?: string;
  onButtonClick?: () => void;
}
