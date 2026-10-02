"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import { Button, Card } from "@/components/ui";
import { canRefine, COACH_LIMITS, type CoachPack } from "@/lib/coach";
import { useCoachAccess } from "@/lib/coach/use-coach";
import { cn } from "@/lib/cn";
import { AccessCard } from "./AccessCard";
import { cancelGeneration, clearGeneration, refineJob, startRefine, useGeneration } from "./generation";
import { FIELD, FOCUS, Notice, Spinner } from "./shared";

const MAX = COACH_LIMITS.refinementsPerPack;
/** The server no longer knows this pack (409 `unknown_pack`): it can be practised, not refined. */
const GONE = "Esta situación ya no se puede ajustar; crea una nueva.";

function remainingText(left: number, gone: boolean): string {
  if (gone) return GONE;
  if (left <= 0) return `Ya has ajustado esta situación ${MAX} veces.`;
  return `Puedes ajustarla ${left} ${left === 1 ? "vez" : "veces"} más (de ${MAX}).`;
}

export interface RefineCardProps {
  pack: CoachPack;
  /** A new version arrived (same id, `refinements + 1`); `saved`: false when the device could not store it. */
  onRefined: (pack: CoachPack, saved: boolean) => void;
}

/** "Ajustar" with one instruction and "Generar otra vez": at most `COACH_LIMITS.refinementsPerPack` per pack. */
export function RefineCard({ pack, onRefined }: RefineCardProps) {
  const id = useId();
  const { hasCode } = useCoachAccess();
  const key = refineJob(pack);
  const [instruction, setInstruction] = useState("");
  const job = useGeneration(key, ({ pack: next, saved }) => {
    setInstruction("");
    onRefined(next, saved);
  });
  const pending = job?.status === "pending" ? (job.input ? "adjust" : "again") : null;
  const error = job?.status === "error" ? job.error : null;
  const gone = error?.code === "unknown_pack" || !canRefine(pack);
  const blocked = error?.kind === "limit" || gone;
  const accessNotice = error?.kind === "unauthorized" ? error.message : null;
  const left = Math.max(0, MAX - pack.refinements);
  const closed = left === 0 || gone;
  const disabled = pending !== null || blocked || closed;

  // A version that arrived while this pack was closed: it is already saved; show it as new.
  const finished = job?.status === "done" ? job : null;
  useEffect(() => {
    if (!finished) return;
    clearGeneration(key);
    onRefined(finished.pack, finished.saved);
  }, [finished, key, onRefined]);

  const edit = (value: string) => {
    setInstruction(value);
    if (error) clearGeneration(key);
  };

  const run = (kind: "adjust" | "again") => {
    const text = kind === "adjust" ? instruction.trim() : "";
    if (disabled || (kind === "adjust" && !text)) return;
    startRefine(pack, text);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    run("adjust");
  };

  if (!hasCode) {
    return (
      <AccessCard
        intro="Para ajustar esta situación o generar otra versión necesitas tu código de acceso."
        notice={accessNotice}
      />
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-extrabold text-ink">¿No es lo que buscabas?</h2>
        <p className={cn("text-sm", closed ? "font-bold text-ink" : "text-ink-muted")}>{remainingText(left, gone)}</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor={id} className="text-base font-bold text-ink">
          Qué quieres cambiar
        </label>
        <div className={cn(FIELD, "flex min-h-12 items-center px-3", closed && "opacity-50")}>
          <input
            id={id}
            value={instruction}
            onChange={(e) => edit(e.target.value)}
            maxLength={COACH_LIMITS.instruction}
            disabled={closed}
            placeholder="Ej.: más corta, con trato de tú"
            enterKeyHint="send"
            className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink-muted"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Button type="submit" size="md" disabled={disabled || !instruction.trim()}>
            {pending === "adjust" ? "Ajustando…" : "Ajustar"}
          </Button>
          <Button variant="secondary" size="md" disabled={disabled} onClick={() => run("again")}>
            {pending === "again" ? "Generando…" : "Generar otra vez"}
          </Button>
        </div>
      </form>
      {pending ? (
        <div role="status" className="flex items-center gap-3">
          <Spinner />
          <p className="flex-1 text-sm text-ink-muted">
            Preparando la nueva versión. Puede tardar hasta un minuto; si sales, se guardará igual. Si cancelas, cuenta
            igual para tu límite y tu gasto.
          </p>
          <button
            type="button"
            onClick={() => cancelGeneration(key)}
            className={cn("min-h-11 text-sm font-bold text-sea underline", FOCUS)}
          >
            Cancelar
          </button>
        </div>
      ) : null}
      {error && !accessNotice && !gone ? <Notice>{error.message}</Notice> : null}
    </Card>
  );
}
