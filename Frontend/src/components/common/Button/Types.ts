export type ButtonRadius = 'sm' | 'md' | 'lg' | 'full';

export const buttonRadiusClassNameMapping: Record<ButtonRadius, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
};
