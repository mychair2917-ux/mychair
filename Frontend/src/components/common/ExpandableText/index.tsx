import type React from 'react';
import { useEffect, useRef, useState } from 'react';

import { ExpandableTextProps } from './Types';

/**
  ExpandableText component displays a text block that can be toggled between
  a truncated (line-clamped) and full view. If the content overflows the defined
  number of lines, a "See all" / "See less" toggle appears.
 
  Parameters:
  @param {string} text - The text to display.
  @param {string} [className] - Optional class names for custom styling.
  @param {number} [lineClamp=2] - Number of lines to clamp before truncating.
  @param {boolean} [expanded=false] - Indicates if text is fully expanded.
  @param {() => void} [onToggle] - Function to toggle expanded state.
  @param {string | number} [rowId] - Optional row identifier.
 
  Returns:
  @returns {JSX.Element} A React component that shows expandable text.

  Exception Handling:
  None
 */
const ExpandableText: React.FC<ExpandableTextProps> = ({
  text,
  className = '',
  lineClamp = 2,
  expanded = false,
  onToggle,
}) => {
  const [isTruncated, setIsTruncated] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const clampClass = `line-clamp-${lineClamp}`;

  useEffect(() => {
    const el = contentRef.current;
    if (el) {
      const isOverflowing = el.scrollHeight > el.clientHeight;
      setIsTruncated(isOverflowing);
    }
  }, [text]);

  return (
    <div className={`text-light-gray text-sm ${className}`}>
      <div ref={contentRef} className={!expanded ? clampClass : ''}>
        {text}
      </div>

      {isTruncated && (
        <button
          className="cursor-pointer text-xs text-blue-400"
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
        >
          {expanded ? 'See less' : 'See all'}
        </button>
      )}
    </div>
  );
};

export default ExpandableText;
