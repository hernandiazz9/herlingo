import { useSyncExternalStore, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Focus ring of every Prepárate control (same as `Button`). */
export const FOCUS = "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep";

/** Destructive button: error colours, same shape and press animation as `Button` (like /perfil). */
export const DANGER = cn(
  "pressable inline-flex items-center justify-center rounded-button border-2 border-error bg-surface px-5 font-bold tracking-wide text-error-deep [--ledge:var(--error-ledge)]",
  FOCUS,
);

/** Text field shell: the input inside is borderless. */
export const FIELD = "rounded-button border-2 border-line bg-surface focus-within:border-sea";

const NOTICE = {
  error: "border-error bg-error-soft",
  info: "border-lemon bg-lemon-soft",
  success: "border-success bg-success-soft",
} as const;

/** A short message in a tinted box: errors are announced at once, the rest politely. */
export function Notice({ tone = "error", className, children }: { tone?: keyof typeof NOTICE; className?: string; children: ReactNode }) {
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-card border-2 px-4 py-3 text-base text-ink", NOTICE[tone], className)}>
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-6 shrink-0 animate-spin rounded-full border-3 border-sea/25 border-t-sea motion-reduce:animate-none",
        className,
      )}
    />
  );
}

function subscribeOnline(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

/** `navigator.onLine`, live (true on the server and during hydration). */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}
