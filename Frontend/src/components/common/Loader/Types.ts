type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export interface DotSpinnerProps {
  size?: SpinnerSize;
  color?: string;
}

export const sizeMap: Record<SpinnerSize, string> = {
  xs: 'w-4 h-4',
  sm: 'w-6 h-6',
  md: 'w-11 h-11',
  lg: 'w-16 h-16',
  xl: 'w-24 h-24',
};

export const dotSizeMap: Record<SpinnerSize, string> = {
  xs: 'w-[25%] h-[25%]',
  sm: 'w-[22%] h-[22%]',
  md: 'w-[20%] h-[20%]',
  lg: 'w-[18%] h-[18%]',
  xl: 'w-[16%] h-[16%]',
};
