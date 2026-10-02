"use client";

import { useId, useState, type FormEvent } from "react";
import { Button, Card } from "@/components/ui";
import { toCoachApiError } from "@/lib/coach";
import { useCoachAccess } from "@/lib/coach/use-coach";
import { cn } from "@/lib/cn";
import { FIELD, Notice } from "./shared";

const INTRO = "Prepárate usa inteligencia artificial y necesita un código. Escríbelo una vez: se guarda en este móvil.";

/**
 * Asks for the access code and checks it with the server; once valid it is stored and every
 * `useCoachAccess()` turns `hasCode`, so the parent swaps this card for what needed the code.
 * `notice`: why it is asked again (a 401 elsewhere forgot the stored code).
 */
export function AccessCard({ intro = INTRO, notice }: { intro?: string; notice?: string | null }) {
  const { verify } = useCoachAccess();
  const id = useId();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      await verify(code);
    } catch (err) {
      const apiError = toCoachApiError(err);
      if (apiError.kind !== "aborted") setError(apiError.message);
    } finally {
      setBusy(false);
    }
  };

  const message = error ?? notice;
  return (
    <Card tone="sea" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-extrabold text-ink">Tu código de acceso</h2>
        <p className="text-base text-ink">{intro}</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label htmlFor={id} className="sr-only">
          Código de acceso
        </label>
        <div className={cn(FIELD, "flex min-h-12 items-center px-3")}>
          <input
            id={id}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Escribe tu código"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            className="min-w-0 flex-1 bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink-muted"
          />
        </div>
        <Button type="submit" size="md" fullWidth disabled={!code.trim() || busy}>
          {busy ? "Comprobando…" : "Entrar"}
        </Button>
      </form>
      {message ? <Notice>{message}</Notice> : null}
    </Card>
  );
}
