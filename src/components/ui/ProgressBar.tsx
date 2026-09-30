import { cn } from "@/lib/cn";

export type ProgressTone = "lemon" | "sea" | "success";

export interface ProgressBarProps {
  /** Current value, clamped to [0, max]. */
  value: number;
  max?: number;
  /** Accessible name (Spain Spanish), e.g. "Progreso de la lección". */
  label: string;
  tone?: ProgressTone;
  className?: string;
}

const FILLS: Record<ProgressTone, string> = {
  lemon: "bg-lemon",
  sea: "bg-sea",
  success: "bg-success",
};

export function ProgressBar({ value, max = 1, label, tone = "lemon", className }: ProgressBarProps) {
  const safeMax = max > 0 ? max : 1;
  const clamped = Math.min(Math.max(value, 0), safeMax);
  const percent = (clamped / safeMax) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={clamped}
      className={cn("h-4 w-full overflow-hidden rounded-full bg-sand", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none",
          FILLS[tone],
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
