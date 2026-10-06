"use client";

import { useState, type FormEvent } from "react";
import { Button, Card } from "@/components/ui";
import { COACH_LIMITS } from "@/lib/coach";
import { useLearnerProfile } from "@/lib/coach/use-coach";

/** "Sobre mí": free notes for the AI, sent with every pack and interview request. */
export function AboutMeCard({ lang }: { lang: string }) {
  const { profile, setAbout } = useLearnerProfile(lang);
  const [draft, setDraft] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const value = draft ?? profile.about;
  const changed = draft !== null && draft.trim() !== profile.about;

  const save = (e: FormEvent) => {
    e.preventDefault();
    if (!changed) return;
    const ok = setAbout(value);
    if (ok) setDraft(null);
    setStatus(ok ? { ok, text: "Guardado." } : { ok, text: "No se ha podido guardar en este móvil." });
  };

  return (
    <Card>
      <form onSubmit={save} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-ink">
            <label htmlFor={`about-${lang}`}>Sobre mí</label>
          </h3>
          <p className="text-sm text-ink-muted">
            Lo que quieras que la IA sepa de ti: con quién viajas, qué te gusta, qué te cuesta. Se guarda en este móvil y
            se envía con cada situación que preparas.
          </p>
        </div>
        <textarea
          id={`about-${lang}`}
          lang="es"
          value={value}
          onChange={(e) => {
            setDraft(e.target.value);
            setStatus(null);
          }}
          maxLength={COACH_LIMITS.about}
          rows={4}
          placeholder="Por ejemplo: viajo con mi pareja en junio, somos vegetarianos y me cuesta entender los números."
          className="w-full resize-y rounded-card border-2 border-line bg-surface p-4 text-base text-ink placeholder:text-ink-muted focus:border-sea focus:outline-none"
        />
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-ink-muted" aria-live="polite">
            {status ? (
              <span className={status.ok ? "font-bold text-success-deep" : "font-bold text-error-deep"}>{status.text}</span>
            ) : (
              `${changed ? "Sin guardar · " : ""}${value.length}/${COACH_LIMITS.about}`
            )}
          </p>
          <Button type="submit" size="md" disabled={!changed}>
            Guardar
          </Button>
        </div>
      </form>
    </Card>
  );
}
