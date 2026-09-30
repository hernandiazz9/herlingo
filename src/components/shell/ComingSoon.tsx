import type { ReactNode } from "react";
import { Card, type CardTone } from "@/components/ui";

export interface ComingSoonProps {
  tone?: CardTone;
  children: ReactNode;
}

/** Placeholder card for sections that are not built yet. */
export function ComingSoon({ tone = "lemon", children }: ComingSoonProps) {
  return (
    <Card tone={tone} className="flex flex-col gap-2">
      <p className="text-sm font-bold uppercase tracking-wider text-terracotta-deep">Muy pronto</p>
      <div className="text-base text-ink">{children}</div>
    </Card>
  );
}
