import { formatUsd, type CoachUsage } from "@/lib/coach";

/** "Te quedan 3,20 $ este mes · Hoy: 2 de 10 usos", from the last usage summary seen. */
export function BudgetLine({ usage, loading }: { usage: CoachUsage | null; loading: boolean }) {
  if (!usage) return loading ? <p className="text-sm text-ink-muted">Comprobando tu presupuesto…</p> : null;
  const spent = usage.remainingUsd <= 0;
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm font-bold">
      <span className={spent ? "text-error-deep" : "text-sea-deep"}>
        {spent ? "Se ha agotado el presupuesto de este mes" : `Te quedan ${formatUsd(usage.remainingUsd)} este mes`}
      </span>
      <span className="text-ink-muted">
        Hoy: {usage.today.used} de {usage.today.limit} usos
      </span>
    </p>
  );
}
