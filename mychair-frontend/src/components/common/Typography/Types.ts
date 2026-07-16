import React, { JSX } from 'react';

export type TypographyVariant =
  | 'large'
  | 'subtitleLarge'
  | 'subtitleMedium'
  | 'subtitleSmall'
  | 'bodyLarge'
  | 'bodyMedium'
  | 'bodySmall'
  | 'bodyExtraSmall'
  | 'caption'
  | 'button'
  | 'hint'
  | 'extraLarge'
  | 'large-1';

export type TypographyFontWeight =
  | 'thin'
  | 'extralight'
  | 'light'
  | 'normal'
  | 'medium'
  | 'semibold'
  | 'bold'
  | 'extrabold'
  | 'black';

export type TypographyColor =
  | 'black'
  | 'red'
  | 'yellow'
  | 'green'
  | 'amber'
  | 'teal'
  | 'purple'
  | 'inherit'
  | 'white'
  | 'dark'
  | 'gray'
  | 'dark-gray'
  | 'light-gray'
  | 'charcoal'
  | 'blue'
  | 'blue-300'
  | 'orange-500'
  | 'purple-300'
  | 'gray-900'
  | 'gray-600'
  | 'blue-400';

export const variantMapping: Record<TypographyVariant, keyof JSX.IntrinsicElements> = {
  subtitleLarge: 'h6',
  subtitleMedium: 'h6',
  subtitleSmall: 'h6',
  bodyLarge: 'p',
  bodyMedium: 'p',
  bodySmall: 'p',
  bodyExtraSmall: 'p',
  caption: 'span',
  button: 'span',
  hint: 'span',
  extraLarge: 'h1',
  large: 'h1',
  'large-1': 'h1',
};

export const typographyVariantClassNameMapping: Record<TypographyVariant, string> = {
  large: '!text-[22px]',
  subtitleLarge: '!text-xl',
  subtitleMedium: '!text-lg',
  subtitleSmall: '!text-base',
  bodyLarge: '!text-base',
  bodyMedium: '!text-sm',
  bodySmall: '!text-xs',
  bodyExtraSmall: '!text-[0.625rem]',
  caption: '!text-xs',
  button: '!text-sm',
  hint: '!text-hint',
  extraLarge: '!text-3xl',
  'large-1': '!text-[21px]',
};

export const typographyFontWeightClassNameMapping: Record<TypographyFontWeight, string> = {
  thin: 'font-thin',
  extralight: 'font-extralight',
  light: 'font-light',
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
  extrabold: 'font-extrabold',
  black: 'font-black',
};

export const typographyColorClassNameMapping: Record<TypographyColor, string> = {
  black: '!text-gray-900',
  red: '!text-red-700',
  yellow: '!text-yellow-400',
  green: '!text-green-600',
  amber: '!text-amber-600',
  teal: '!text-teal-600',
  purple: '!text-purple-800',
  inherit: '!text-inherit',
  white: '!text-white',
  dark: '!text-black',
  blue: '!text-blue-400',
  gray: '!text-gray-700',
  'dark-gray': '!text-[#4A4A4A]',
  'light-gray': '!text-[#2C2C2C99]',
  charcoal: '!text-[#202532]',
  'blue-300': '!text-blue-300',
  'orange-500': '!text-orange-500',
  'purple-300': '!text-purple-300',
  'gray-900': '!text-gray-900',
  'gray-600': '!text-gray-600',
  'blue-400': '!text-blue-400',
};

export interface TypographyProps extends React.HTMLAttributes<HTMLElement> {
  color?: TypographyColor;
  fontWeight?: TypographyFontWeight;
  variant?: TypographyVariant;
  as?: React.ElementType;
  whiteSpace?: 'normal' | 'pre-line' | 'pre-wrap' | 'pre' | 'nowrap';
}
