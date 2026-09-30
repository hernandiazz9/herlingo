import type { SVGProps } from "react";

/** Tab bar icons added with Historias and Jugar (same style as `@/components/icons`). */
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

/** Closed book with a bookmark ribbon. */
export function StoriesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 19.5V5a2 2 0 0 1 2-2h12v15H7a2 2 0 0 0-2 2Zm0 0A2 2 0 0 0 7 21.5h12" />
      <path d="M11 3v7l2-1.5 2 1.5V3" />
    </Svg>
  );
}

/** Game controller. */
export function GameIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M7.5 7h9a4.5 4.5 0 0 1 4.4 5.5l-.9 4a2.6 2.6 0 0 1-4.5 1.1L14 16h-4l-1.5 1.6A2.6 2.6 0 0 1 4 16.5l-.9-4A4.5 4.5 0 0 1 7.5 7Z" />
      <path d="M8 10v4M6 12h4" />
      <path d="M15.5 11h.01M17.5 13h.01" strokeWidth={3} />
    </Svg>
  );
}
