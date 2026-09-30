import type { ComponentPropsWithRef } from "react";
import { cn } from "@/lib/cn";

export type CardTone = "default" | "lemon" | "sea" | "terracotta";

export interface CardProps extends ComponentPropsWithRef<"div"> {
  tone?: CardTone;
}

const TONES: Record<CardTone, string> = {
  default: "bg-surface border-line",
  lemon: "bg-lemon-soft border-lemon",
  sea: "bg-sea-soft border-sea/30",
  terracotta: "bg-terracotta-soft border-terracotta/30",
};

/** Rounded content surface. */
export function Card({ tone = "default", className, ...props }: CardProps) {
  return (
    <div
      data-tone={tone}
      className={cn("rounded-card border-2 p-5", TONES[tone], className)}
      {...props}
    />
  );
}
