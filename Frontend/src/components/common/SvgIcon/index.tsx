import React from 'react';

import { cn } from '../../../utils/cn';
import { iconColorClassNameMapping, iconSizeClassNameMapping, SvgIconProps } from './Types';

const SvgIcon = React.forwardRef<SVGSVGElement, SvgIconProps>(
  (
    { className, color = 'black', disabled, size = 'lg', children, strokeWidth, ...others },
    ref
  ) => {
    return (
      <svg
        data-testid="mychair-svg-icon"
        ref={ref}
        xmlns="http://www.w3.org/2000/svg"
        className={cn(
          'inline-block h-[1em] w-[1em] flex-shrink-0 fill-current select-none',
          { 'opacity-50': disabled },
          iconSizeClassNameMapping[size],
          iconColorClassNameMapping[disabled ? 'black' : color],
          className
        )}
        focusable={false}
        aria-hidden={true}
        viewBox="0 0 24 24"
        strokeWidth={strokeWidth}
        {...others}
      >
        {children}
      </svg>
    );
  }
);

export default SvgIcon;
