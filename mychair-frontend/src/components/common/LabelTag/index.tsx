import React from 'react';

import { cn } from '../../../utils/cn';
import { LabelTagProps } from './Types';

/**
Renders a customizable label tag component with dynamic colors.

This component displays a small, rounded label with optional background color,
border color, and text color. Useful for status indicators, categories, or badges.

Parameters:
None (props are passed via the LabelTagProps interface)

Returns:
JSX.Element - A styled label tag with dynamic styles applied inline.

Exception Handling:
None
*/
const LabelTag: React.FC<LabelTagProps> = ({
  text,
  bgColor,
  borderColor,
  textColor,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full border text-xs font-medium',
        className
      )}
      style={{
        backgroundColor: bgColor,
        borderColor: borderColor,
        color: textColor,
      }}
    >
      {text}
    </div>
  );
};

export default LabelTag;
