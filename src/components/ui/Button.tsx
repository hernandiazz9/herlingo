import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary";
export type ButtonSize = "md" | "lg";

export interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-sea text-on-accent [--ledge:var(--sea-ledge)] hover:brightness-105",
  secondary: "bg-surface text-sea border-2 border-line [--ledge:var(--line)] hover:bg-sea-soft/40",
};

const SIZES: Record<ButtonSize, string> = {
  md: "min-h-12 px-5 text-base",
  lg: "min-h-14 px-6 text-lg",
};

/** Big rounded button with a "ledge" that it sinks into when pressed. */
export function Button({
  variant = "primary",
  size = "lg",
  fullWidth = false,
  type = "button",
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      data-variant={variant}
      className={cn(
        "pressable inline-flex items-center justify-center gap-2 rounded-button font-bold tracking-wide",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
        "disabled:cursor-not-allowed disabled:opacity-50",
        VARIANTS[variant],
        SIZES[size],
        fullWidth && "w-full",
        className,
      )}
      {...props}
    />
  );
}
