import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type IconButtonVariant = "primary" | "secondary";

export interface IconButtonProps extends Omit<ComponentPropsWithRef<"button">, "children"> {
  /** Accessible name (Spain Spanish, e.g. "Escuchar"). Required: the button shows only an icon. */
  label: string;
  icon: ReactNode;
  variant?: IconButtonVariant;
}

const VARIANTS: Record<IconButtonVariant, string> = {
  primary: "bg-sea text-on-accent [--ledge:var(--sea-ledge)]",
  secondary: "bg-surface text-sea border-2 border-line [--ledge:var(--line)]",
};

/** Round icon-only button (48px, a comfortable touch target) with the shared press animation. */
export function IconButton({
  label,
  icon,
  variant = "secondary",
  type = "button",
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "pressable inline-flex size-12 shrink-0 items-center justify-center rounded-full",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      <span aria-hidden="true" className="inline-flex size-6 items-center justify-center">
        {icon}
      </span>
    </button>
  );
}
