"use client";

import { useState, useSyncExternalStore, type FormEvent, type ReactNode } from "react";
import { Button, Card, ProgressBar } from "@/components/ui";
import { formatUsd, toCoachApiError, updateMonthlyCap, type CoachUsage } from "@/lib/coach";
import { useCoachAccess, useCoachUsage } from "@/lib/coach/use-coach";

const BILLING_URL = "https://platform.claude.com/settings/billing";
const MAX_CAP_USD = 1000;

const noSubscribe = () => () => {};

/** False on the server and during hydration: device data (code, usage) is unknown until then. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noSubscribe, () => true, () => false);
}

const LINK_TEXT = "text-base font-bold text-sea underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep";

/** Asks for the Prepárate access code and stores it once the server accepts it. */
export function CoachCodeForm({ intro }: { intro?: ReactNode }) {
  const { verify } = useCoachAccess();
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
      setError(toCoachApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      {intro ? <p className="text-base text-ink-muted">{intro}</p> : null}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-bold text-ink">Código de acceso</span>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value)}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          className="min-h-12 w-full rounded-button border-2 border-line bg-surface px-4 text-lg text-ink placeholder:text-ink-muted focus:border-sea focus:outline-none"
          placeholder="Escribe tu código"
        />
      </label>
      {error ? (
        <p role="alert" className="rounded-button bg-error-soft px-4 py-3 text-base text-error-deep">
          {error}
        </p>
      ) : null}
      <Button type="submit" size="md" disabled={busy || !code.trim()}>
        {busy ? "Comprobando…" : "Entrar"}
      </Button>
    </form>
  );
}

function formatMonth(month: string): string {
  const date = new Date(`${month}-01T12:00:00`);
  return Number.isNaN(date.getTime()) ? month : date.toLocaleDateString("es-ES", { month: "long", year: "numeric" });
}

function formatTime(epochMs: number): string {
  return new Date(epochMs).toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

const formatInt = (n: number) => Math.round(n).toLocaleString("es-ES");

/**
 * "Uso de IA": this month's spend against the cap, what is left, tokens, average cost per pack and
 * today's generations, from the last summary seen (refreshed on mount). The owner can change the
 * monthly cap and gets the Anthropic billing link.
 */
export function AiUsagePanel() {
  const hydrated = useHydrated();
  const { hasCode, clear } = useCoachAccess();
  const { usage, updatedAt, loading, error, refresh } = useCoachUsage();

  if (!hydrated) return <Card className="min-h-32" aria-busy="true" />;

  if (!hasCode) {
    return (
      <Card>
        <CoachCodeForm intro="Escribe tu código de acceso de Prepárate para ver cuánto se ha gastado este mes." />
      </Card>
    );
  }

  if (!usage) {
    return (
      <Card className="flex flex-col gap-3">
        <p className="text-base text-ink-muted" aria-live="polite">
          {loading ? "Cargando el uso de este mes…" : error ? error.message : "Todavía no hay datos de uso."}
        </p>
        {!loading ? (
          <Button size="md" variant="secondary" onClick={() => void refresh()}>
            Reintentar
          </Button>
        ) : null}
      </Card>
    );
  }

  const exhausted = usage.remainingUsd <= 0;
  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-2xl font-extrabold text-ink">
          {exhausted ? "Se ha agotado el presupuesto de este mes" : `Te quedan ${formatUsd(usage.remainingUsd)} este mes`}
        </p>
        <ProgressBar
          value={usage.spentUsd}
          max={usage.capUsd}
          label="Presupuesto gastado este mes"
          tone={exhausted ? "lemon" : "sea"}
        />
        <p className="text-sm text-ink-muted">
          Gastado en {formatMonth(usage.month)}: <b className="text-ink">{formatUsd(usage.spentUsd)}</b> de{" "}
          {formatUsd(usage.capUsd)}
          {usage.mineUsd < usage.spentUsd ? ` (tú, ${formatUsd(usage.mineUsd)})` : ""}
        </p>
      </div>

      <dl className="grid grid-cols-2 gap-3">
        <UsageStat label="Hoy" value={`${usage.today.used} de ${usage.today.limit}`} note="generaciones" />
        <UsageStat
          label="Situaciones"
          value={formatInt(usage.packs)}
          note={usage.packs ? `media ${formatUsd(usage.avgPackUsd, 3)}` : "este mes"}
        />
      </dl>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-bold text-ink">Tokens este mes</p>
        <p className="text-sm text-ink-muted">
          {formatInt(usage.tokens.input)} de entrada · {formatInt(usage.tokens.output)} de salida ·{" "}
          {formatInt(usage.tokens.cacheRead)} leídos de caché
          {usage.tokens.cacheWrite ? ` · ${formatInt(usage.tokens.cacheWrite)} escritos en caché` : ""}
        </p>
      </div>

      <p className="text-sm text-ink-muted">
        Anthropic no informa del saldo: lo que queda es el límite mensual menos lo gastado desde la app.
      </p>

      {usage.isOwner ? <CapEditor usage={usage} /> : null}

      {usage.isOwner ? (
        <a href={BILLING_URL} target="_blank" rel="noopener noreferrer" className={LINK_TEXT}>
          Ver la facturación en Anthropic
        </a>
      ) : null}

      <div className="flex flex-col gap-2">
        <p className="text-xs text-ink-muted" aria-live="polite">
          {loading
            ? "Actualizando…"
            : error
              ? `No se ha podido actualizar: ${error.message}${updatedAt ? ` Datos del ${formatTime(updatedAt)}.` : ""}`
              : updatedAt
                ? `Actualizado el ${formatTime(updatedAt)}.`
                : ""}
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button type="button" onClick={() => void refresh()} disabled={loading} className={`${LINK_TEXT} disabled:opacity-50`}>
            Actualizar
          </button>
          <button type="button" onClick={clear} className={LINK_TEXT}>
            Cambiar de código
          </button>
        </div>
      </div>
    </Card>
  );
}

function UsageStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-button bg-sand p-3">
      <dt className="text-sm font-bold text-ink-muted">{label}</dt>
      <dd className="text-xl font-extrabold text-ink">{value}</dd>
      <dd className="text-xs text-ink-muted">{note}</dd>
    </div>
  );
}

function parseUsd(text: string): number | null {
  const n = Number(text.trim().replace(",", "."));
  return text.trim() && Number.isFinite(n) && n >= 0 && n <= MAX_CAP_USD ? n : null;
}

/** Owner only: the monthly cap for every code. */
function CapEditor({ usage }: { usage: CoachUsage }) {
  const [draft, setDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const value = draft ?? String(usage.capUsd).replace(".", ",");
  const parsed = parseUsd(value);

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (parsed === null || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const updated = await updateMonthlyCap(parsed);
      setDraft(null);
      setMessage({ ok: true, text: `Límite guardado: ${formatUsd(updated.capUsd)} al mes.` });
    } catch (err) {
      setMessage({ ok: false, text: toCoachApiError(err).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-2 rounded-button border-2 border-line p-3">
      <label htmlFor="coach-cap" className="text-sm font-bold text-ink">
        Límite mensual (USD, para todos los códigos)
      </label>
      <div className="flex gap-2">
        <input
          id="coach-cap"
          value={value}
          onChange={(e) => {
            setDraft(e.target.value);
            setMessage(null);
          }}
          inputMode="decimal"
          autoComplete="off"
          aria-invalid={parsed === null}
          className="min-h-12 w-full min-w-0 flex-1 rounded-button border-2 border-line bg-surface px-4 text-lg font-bold text-ink focus:border-sea focus:outline-none aria-[invalid=true]:border-error"
        />
        <Button type="submit" size="md" disabled={busy || parsed === null || parsed === usage.capUsd}>
          {busy ? "Guardando…" : "Guardar"}
        </Button>
      </div>
      {parsed === null ? (
        <p className="text-sm text-error-deep">Escribe una cantidad entre 0 y {MAX_CAP_USD}.</p>
      ) : null}
      {message ? (
        <p role={message.ok ? "status" : "alert"} className={message.ok ? "text-sm text-success-deep" : "text-sm text-error-deep"}>
          {message.text}
        </p>
      ) : null}
    </form>
  );
}
