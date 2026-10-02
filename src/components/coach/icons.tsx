import type { SVGProps } from "react";

/** Extra inline icons for Prepárate (same style as `@/components/icons`). */
type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Two sparkles: the AI coach. */
export function SparklesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M10 3.5 11.6 8a3 3 0 0 0 1.9 1.9L18 11.5 13.5 13a3 3 0 0 0-1.9 1.9L10 19.5 8.4 14.9A3 3 0 0 0 6.5 13L2 11.5 6.5 10A3 3 0 0 0 8.4 8Z" />
      <path d="M18.5 2.5v4M16.5 4.5h4M19 16v3.5M17.25 17.75h3.5" />
    </Svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="m9 5 7 7-7 7" />
    </Svg>
  );
}

/** Bin: delete. */
export function TrashIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7" />
      <path d="M9 7V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V7" />
    </Svg>
  );
}
