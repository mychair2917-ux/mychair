import React from 'react';

import SvgIcon from '.';
import { SvgIconProps } from './Types';

export function createSvgIcon(path: React.ReactNode) {
  const Component = React.forwardRef<SVGSVGElement, SvgIconProps>((props, ref) => {
    return (
      <SvgIcon ref={ref} {...props}>
        {path}
      </SvgIcon>
    );
  });
  return Component;
}
