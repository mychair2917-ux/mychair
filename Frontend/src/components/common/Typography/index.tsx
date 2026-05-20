import React from 'react';

import { cn } from '../../../utils/cn';
import {
  typographyColorClassNameMapping,
  typographyFontWeightClassNameMapping,
  TypographyProps,
  TypographyVariant,
  typographyVariantClassNameMapping,
  variantMapping,
} from './Types';

/**
  Utility function to get the appropriate component for the given typography variant.
 
  @param {TypographyVariant} variant - The typography variant (e.g., 'bodyLarge', 'h1', etc.).
  @param {React.ElementType} [component] - Optionally, the custom component to render.
  @returns {React.ElementType} The component to render.
 */
const getComponentName = (
  variant: TypographyVariant,
  component?: React.ElementType
): React.ElementType => {
  return component ?? variantMapping[variant];
};

/**
 Typography component that handles various text styles such as font size, color, weight, and variant.
 
 This component allows you to easily customize the text appearance by using predefined variants,
 font weights, colors, and the ability to render as a different HTML element (e.g., 'h1', 'p').

 @param {TypographyProps} props - The properties for the Typography component.
 @param {string} props.className - Additional custom class names for styling.
 @param {string} [props.color='black'] - The color of the text. Defaults to 'black'.
 @param {string} [props.fontWeight='normal'] - The font weight. Defaults to 'normal'.
 @param {TypographyVariant} [props.variant='bodyLarge'] - The typography variant to use. Defaults to 'bodyLarge'.
 @param {React.ElementType} [props.as] - The HTML element or component to render (e.g., 'h1', 'p'). Defaults to the component mapped for the variant.
 @param {React.ReactNode} props.children - The content to render inside the typography component.
 @param {React.Ref<HTMLElement>} ref - Forwarded ref for the component.
 
 @returns {JSX.Element} The rendered typography component.
 */
const Typography = React.forwardRef<HTMLElement, TypographyProps>(
  (
    {
      className,
      color = 'black',
      fontWeight = 'normal',
      variant = 'bodyLarge',
      as,
      children,
      whiteSpace,
      style,
      ...others
    },
    ref
  ) => {
    // Get the component to render based on the variant and the `as` prop
    const Component = getComponentName(variant, as);

    return (
      <Component
        data-testid="mychair-typography"
        className={cn(
          'm-0 normal-case',
          typographyFontWeightClassNameMapping[fontWeight],
          typographyVariantClassNameMapping[variant],
          typographyColorClassNameMapping[color],
          className
        )}
        style={{
          ...style,
          ...(whiteSpace && { whiteSpace }),
        }}
        {...others}
        ref={ref}
      >
        {children}
      </Component>
    );
  }
);

export default Typography;
