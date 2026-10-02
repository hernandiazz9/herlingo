"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button, Card } from "@/components/ui";
import { COACH_LIMITS, refinePack, toCoachApiError, type CoachApiError, type CoachPack } from "@/lib/coach";
import { useCoachAccess, useSavedPacks } from "@/lib/coach/use-coach";
import { cn } from "@/lib/cn";
import { AccessCard } from "./AccessCard";
import { FIELD, Notice, Spinner } from "./shared";

const MAX = COACH_LIMITS.refinementsPerPack;

function remainingText(left: number): string {
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
  const { replace } = useSavedPacks(pack.lang);
  const [instruction, setInstruction] = useState("");
  const [pending, setPending] = useState<"adjust" | "again" | null>(null);
  const [error, setError] = useState<CoachApiError | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [accessNotice, setAccessNotice] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const left = Math.max(0, MAX - pack.refinements);
  const disabled = pending !== null || blocked || left === 0;

  useEffect(() => () => request.current?.abort(), []);

  const run = async (kind: "adjust" | "again") => {
    const text = kind === "adjust" ? instruction.trim() : "";
    if (disabled || (kind === "adjust" && !text)) return;
    const ctrl = new AbortController();
    request.current = ctrl;
    setPending(kind);
    setError(null);
    try {
      const { pack: next } = await refinePack(pack, text, { signal: ctrl.signal });
      const saved = replace(next);
      setInstruction("");
      onRefined(next, saved);
    } catch (err) {
      const apiError = toCoachApiError(err);
      if (apiError.kind === "unauthorized") setAccessNotice(apiError.message);
      else if (apiError.kind !== "aborted") {
        if (apiError.kind === "limit") setBlocked(true);
        setError(apiError);
      }
    } finally {
      if (request.current === ctrl) request.current = null;
      setPending(null);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run("adjust");
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
        <p className={cn("text-sm", left ? "text-ink-muted" : "font-bold text-ink")}>{remainingText(left)}</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor={id} className="text-base font-bold text-ink">
          Qué quieres cambiar
        </label>
        <div className={cn(FIELD, "flex min-h-12 items-center px-3", left === 0 && "opacity-50")}>
          <input
            id={id}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            maxLength={COACH_LIMITS.instruction}
            disabled={left === 0}
            placeholder="Ej.: más corta, con trato de tú"
            enterKeyHint="send"
            className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink-muted"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Button type="submit" size="md" disabled={disabled || !instruction.trim()}>
            {pending === "adjust" ? "Ajustando…" : "Ajustar"}
          </Button>
          <Button variant="secondary" size="md" disabled={disabled} onClick={() => void run("again")}>
            {pending === "again" ? "Generando…" : "Generar otra vez"}
          </Button>
        </div>
      </form>
      {pending ? (
        <div role="status" className="flex items-center gap-3">
          <Spinner />
          <p className="flex-1 text-sm text-ink-muted">Preparando la nueva versión. Puede tardar hasta un minuto.</p>
          <button type="button" onClick={() => request.current?.abort()} className="text-sm font-bold text-sea underline">
            Cancelar
          </button>
        </div>
      ) : null}
      {error ? <Notice>{error.message}</Notice> : null}
    </Card>
  );
}
