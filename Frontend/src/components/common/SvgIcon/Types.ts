import React from 'react';

export type IconSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'inherit';

export type IconColor =
  | 'black'
  | 'red'
  | 'green'
  | 'amber'
  | 'teal'
  | 'purple'
  | 'white'
  | 'blue'
  | 'inherit'
  | 'gray'
  | 'light-blue'
  | 'charcoal-gray'
  | 'off-white'
  | 'charcoal'
  | 'yellow'
  | 'orange'
  | 'cobalt-blue'
  | 'emerald-green';

export const iconSizeClassNameMapping: Record<IconSize, string> = {
  xs: '!text-xs',
  sm: '!text-base',
  md: '!text-xl',
  lg: '!text-2xl',
  xl: '!text-[2rem]',
  '2xl': '!text-5xl',
  '3xl': '!text-[107px]',
  inherit: '!text-font-size-inherit',
};

export const iconColorClassNameMapping: Record<IconColor, string> = {
  black: 'text-[var(--color-gray-900)]',
  red: 'text-[var(--color-red-500)]',
  green: 'text-[var(--color-green-300)]',
  amber: 'text-[var(--color-yellow-400)]',
  teal: 'text-[var(--color-green-400)]',
  purple: 'text-[var(--color-purple-500)]',
  white: 'text-white',
  blue: 'text-[var(--color-blue-900)]',
  'light-blue': 'text-[var(--color-blue-400)]',
  gray: 'text-[var(--color-gray-300)]',
  inherit: 'text-inherit',
  'charcoal-gray': 'text-gray-800',
  charcoal: 'text-[var(--color-gray-700)]',
  'off-white': 'text-gray-200',
  yellow: 'text-yellow-400',
  orange: 'text-orange-500',
  'cobalt-blue': 'text-blue-500',
  'emerald-green': 'text-green-600',
};

export interface SvgIconProps extends React.HTMLAttributes<SVGSVGElement> {
  size?: IconSize;
  color?: IconColor;
  disabled?: boolean;
  viewBox?: string;
  strokeWidth?: number;
}
