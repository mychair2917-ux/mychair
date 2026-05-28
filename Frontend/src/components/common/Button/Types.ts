export type ButtonRadius = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'success' | 'ghost';

export const buttonRadiusClassNameMapping: Record<ButtonRadius, string> = {
  sm: 'rounded-sm',
  md: 'rounded-md',
  lg: 'rounded-lg',
  xl: 'rounded-xl',
  full: 'rounded-full',
};
