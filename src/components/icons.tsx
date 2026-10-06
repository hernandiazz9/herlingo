import type { SVGProps } from "react";

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

/** Winding path with a start and end point. */
export function PathIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5" />
    </Svg>
  );
}

/** Circular arrows. */
export function ReviewIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M20 11a8 8 0 0 0-14.3-4.9L4 8" />
      <path d="M4 3v5h5" />
      <path d="M4 13a8 8 0 0 0 14.3 4.9L20 16" />
      <path d="M20 21v-5h-5" />
    </Svg>
  );
}

/** Open book. */
export function PhrasebookIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M12 6.5C10 5 7.5 4.5 3.5 4.5v14c4 0 6.5.5 8.5 2 2-1.5 4.5-2 8.5-2v-14c-4 0-6.5.5-8.5 2Z" />
      <path d="M12 6.5v14" />
    </Svg>
  );
}

/** Two speech bubbles. */
export function DialoguesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 9V5.5A2.5 2.5 0 0 0 11.5 3h-6A2.5 2.5 0 0 0 3 5.5v4A2.5 2.5 0 0 0 5.5 12H6v3l3-3" />
      <path d="M10 12.5A2.5 2.5 0 0 1 12.5 10h6a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1-2.5 2.5H18v3l-3-3h-2.5a2.5 2.5 0 0 1-2.5-2.5Z" />
    </Svg>
  );
}

/** Person silhouette. */
export function ProfileIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </Svg>
  );
}

/** Speaker with sound waves. */
export function SpeakerIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11 5 6 9H3v6h3l5 4Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </Svg>
  );
}

/** Microphone: start listening. */
export function MicIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </Svg>
  );
}

/** Crossed-out microphone: the mic is not available. */
export function MicOffIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M15 10V6a3 3 0 0 0-5.7-1.3M9 9v2a3 3 0 0 0 4.6 2.5" />
      <path d="M5 11a7 7 0 0 0 11.3 5.5M19 11a7 7 0 0 1-.5 2.6M12 18v3M3 3l18 18" />
    </Svg>
  );
}

/** Rounded square: finish listening and keep what was said. */
export function MicStopIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" />
    </Svg>
  );
}
