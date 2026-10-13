import type { SVGProps } from "react";

/** Extra inline icons for Modo deporte (same style as `@/components/icons`). */
type IconProps = SVGProps<SVGSVGElement>;

function Svg({ children, ...props }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true" focusable="false" {...props}>
      {children}
    </svg>
  );
}

/** Previous step (previous track). */
export function PreviousStepIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="5" y="5.5" width="2.5" height="13" rx="1" />
      <path d="M19 5.5v13L9 12Z" />
    </Svg>
  );
}

/** Next step (next track). */
export function NextStepIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="16.5" y="5.5" width="2.5" height="13" rx="1" />
      <path d="M5 5.5v13L15 12Z" />
    </Svg>
  );
}

/** Save the mp3 (download / share). */
export function SaveIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M11 4.5a1 1 0 1 1 2 0v8.59l2.8-2.8a1 1 0 1 1 1.4 1.42l-4.5 4.5a1 1 0 0 1-1.4 0l-4.5-4.5a1 1 0 1 1 1.4-1.42l2.8 2.8Z" />
      <path d="M5 17.5a1 1 0 0 1 1 1v.5h12v-.5a1 1 0 1 1 2 0V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-1.5a1 1 0 0 1 1-1Z" />
    </Svg>
  );
}
