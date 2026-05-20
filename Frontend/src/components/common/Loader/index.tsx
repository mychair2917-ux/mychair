import React from 'react';

import { cn } from '../../../utils/cn';
import Typography from '../Typography';
import { dotSizeMap, DotSpinnerProps, sizeMap } from './Types';

/**
Renders a circular dot spinner loader with animated pulsing dots.

The loader displays 8 dots arranged in a circle, each with a staggered animation delay
to create a smooth rotating pulse effect. The size and color of the spinner can be customized.

Parameters:
- size: 'sm' | 'md' | 'lg' (optional) — Controls the overall size of the spinner. Defaults to 'md'.
- color: string (optional) — Sets the tailwind color class for the dots. Defaults to 'bg-blue-500'.

Returns:
JSX.Element - A responsive animated loader spinner with a "Loading..." label.

Exception Handling:
None
*/
const Loader: React.FC<DotSpinnerProps> = ({ size = 'md', color = 'bg-blue-500' }) => {
  const delays = ['-0.875s', '-0.75s', '-0.625s', '-0.5s', '-0.375s', '-0.25s', '-0.125s', '0s'];

  return (
    <div className="flex h-full flex-1 flex-col items-center justify-center">
      <div className={cn('relative flex items-center justify-start', sizeMap[size])}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 left-0 flex h-full w-full items-center justify-start"
            style={{ transform: `rotate(${i * 45}deg)` }}
          >
            <div
              className={cn(
                'animate-dot-pulse rounded-full opacity-50 shadow-[0_0_20px_rgba(18,31,53,0.3)]',
                dotSizeMap[size],
                color
              )}
              style={{ animationDelay: delays[i] }}
            />
          </div>
        ))}
      </div>
      <Typography>Loading...</Typography>
    </div>
  );
};

export default Loader;
