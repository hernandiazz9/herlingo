"use client";

import { useEffect, useRef, useState } from "react";
import { subscribeXpAwards, type XpSource } from "@/lib/progress";

/** Sources without a summary screen of their own: their XP shows as a small floating "+N XP". */
const TOASTED: Partial<Record<XpSource, string>> = { listen: "🎧", discover: "💡", grammar: "📖" };
const SHOW_MS = 1600;

interface Toast {
  amount: number;
  icon: string;
  /** Changes on every award so the pop animation replays. */
  seq: number;
}

/** Mounted once in the root layout: quick awards that land together add up in one pill. */
export function XpToast() {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = subscribeXpAwards((award) => {
      const icon = TOASTED[award.source];
      if (!icon) return;
      setToast((prev) => ({ amount: (prev?.amount ?? 0) + award.amount, icon, seq: (prev?.seq ?? 0) + 1 }));
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setToast(null), SHOW_MS);
    });
    return () => {
      unsubscribe();
      clearTimeout(timer.current);
    };
  }, []);

  if (!toast) return null;
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-[calc(var(--safe-top)+0.75rem)] z-[70] mx-auto flex w-full max-w-[var(--column-width)] justify-end px-4"
    >
      <span
        key={toast.seq}
        className="rounded-full border-2 border-lemon-deep bg-lemon px-3 py-1 text-base font-extrabold text-on-lemon shadow-[0_4px_12px_-4px_var(--shadow)] transition-transform duration-200 ease-out starting:scale-75 motion-reduce:transition-none"
      >
        <span aria-hidden="true">{toast.icon} </span>+{toast.amount} XP
      </span>
    </div>
  );
}
