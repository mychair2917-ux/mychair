import { SVGProps } from 'react';

export interface IconProps extends SVGProps<SVGSVGElement> {
  size?: 'sm' | 'md' | 'lg' | string;
  disabled?: boolean;
}

export const PlaceholderIcon = ({ size, disabled, ...props }: IconProps) => {
  let width = props.width || "24";
  let height = props.height || "24";
  if (size) {
    if (size === 'sm') { width = "16"; height = "16"; }
    else if (size === 'md') { width = "20"; height = "20"; }
    else if (size === 'lg') { width = "28"; height = "28"; }
    else if (size === '2xl') { width = "36"; height = "36"; }
    else if (!isNaN(Number(size))) { width = size; height = size; }
  }

  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : undefined,
        ...props.style
      }}
      {...props}
    >
      <path
        d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
        fill="currentColor"
      />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </svg>
  );
};
