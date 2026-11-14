"use client";

import { useState, useSyncExternalStore } from "react";
import { SpeakPanel, useListen } from "@/components/speech";
import { Button, Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { getPack, listPacks } from "@/lib/content";
import { useScreenLang } from "@/lib/content/use-active-lang";
import {
  LISTEN_ERROR_MESSAGES,
  SPEECH_LOG_KEY,
  browserFamily,
  canRecognize,
  clearSpeechLog,
  isStandalone,
  type BrowserFamily,
  type ListenEndReason,
  type ListenErrorKind,
  type ListenMode,
  type ListenResult,
  type ListenStatus,
  type SpeechLogEntry,
} from "@/lib/speech";
import { useSpeechLog } from "./use-speech-log";

const SPANISH_LOCALE = "es-ES";
/** The «Respuesta larga» test: an interview answer in English, like Mi entrevista (`answer` mode). */
const ANSWER_LOCALE = "en-AU";
/** Attempts listed on screen (the log keeps more; "Copiar registro" copies all of them). */
const SHOWN = 15;

const noSubscribe = () => () => {};
const never = () => false;
const unknownBrowser = (): BrowserFamily | null => null;
const currentBrowser = (): BrowserFamily => browserFamily();

const BROWSER_NAMES: Record<BrowserFamily, string> = {
  "ios-safari": "Safari en iPhone",
  "ios-chrome": "Chrome en iPhone",
  "ios-other": "otro navegador en iPhone",
  "android-chrome": "Chrome en Android",
  "android-other": "otro navegador en Android",
  edge: "Edge",
  chrome: "Chrome",
  safari: "Safari",
  firefox: "Firefox",
  other: "otro navegador",
};

const REASONS: Record<ListenEndReason, string> = {
  silence: "se paró sola tras un silencio",
  finish: "la terminaste tú",
  cap: "llegó al tiempo máximo",
  ended: "el navegador la cerró",
  "end-timeout": "el navegador no contestó al final y se cerró a la fuerza",
  "no-speech": "no se oyó nada",
  "start-timeout": "el micrófono no llegó a abrirse",
  cancel: "la cancelaste",
  replaced: "empezó otra escucha",
  hidden: "la app pasó a segundo plano",
  error: "el navegador dio un error",
};

const ERRORS: Record<ListenErrorKind, string> = {
  unsupported: "Sin reconocimiento de voz",
  "not-allowed": "Sin permiso para el micrófono",
  "no-speech": "No te oyó",
  "audio-capture": "Micrófono no disponible",
  network: "Sin conexión",
  "start-timeout": "El micrófono no arrancó",
  aborted: "Cancelado",
  other: "Otro error",
};

const STEPS: readonly { status: ListenStatus; key: keyof SpeechLogEntry["timings"] | null; label: string }[] = [
  { status: "starting", key: null, label: "Abriendo el micrófono" },
  { status: "listening", key: "listening", label: "Micrófono abierto" },
  { status: "hearing", key: "hearing", label: "Te oye" },
  { status: "processing", key: "processing", label: "Procesando" },
];

function seconds(ms: number): string {
  return `${(ms / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} s`;
}

/** "10 s", or "3 min" for whole minutes. */
function duration(ms: number): string {
  return ms >= 60_000 && ms % 60_000 === 0 ? `${ms / 60_000} min` : seconds(ms);
}

const MODE_NAMES: Record<ListenMode, string> = {
  phrase: "frase corta",
  long: "respuesta larga",
  answer: "respuesta de entrevista",
};

/** "Italiano (it-IT)", "Español (es-ES)", or the code itself. */
function localeName(locale: string): string {
  if (locale === SPANISH_LOCALE) return `Español (${locale})`;
  const pack = listPacks().find((m) => m.speechLocale === locale);
  return pack ? `${pack.name} (${locale})` : locale;
}

function when(at: string): string {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return at;
  return d.toLocaleString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function MicTestView() {
  const lang = useScreenLang();
  const supported = useSyncExternalStore(noSubscribe, canRecognize, never);
  const standalone = useSyncExternalStore(noSubscribe, isStandalone, never);
  const browser = useSyncExternalStore(noSubscribe, currentBrowser, unknownBrowser);
  const log = useSpeechLog();
  if (!lang || !browser) return null;
  const meta = getPack(lang).meta;

  return (
    <>
      <SupportCard supported={supported} standalone={standalone} browser={browser} />

      <section aria-labelledby="try-title" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 id="try-title" className="text-2xl font-extrabold tracking-tight text-ink">
            Prueba a hablar
          </h2>
          <p className="text-sm text-ink-muted">
            Toca el micrófono y di una frase. Se para sola cuando te callas; toca otra vez para terminar antes.
          </p>
        </div>
        {supported ? (
          <>
            <TryCard title={`En ${meta.name.toLocaleLowerCase("es")}`} locale={meta.speechLocale} lang={lang} log={log} />
            {/* A Spanish pack (any es-XX) already is the Spanish test. */}
            {!meta.speechLocale.startsWith("es-") ? (
              <TryCard title="En español" locale={SPANISH_LOCALE} lang="es" log={log} />
            ) : null}
            <TryCard
              title="Respuesta larga (inglés, en-AU)"
              locale={ANSWER_LOCALE}
              lang="en"
              mode="answer"
              hint="Responde en inglés como en una entrevista, de 30 segundos a 3 minutos. Si el navegador corta antes, sigue escuchando solo."
              log={log}
            />
          </>
        ) : (
          <Card>
            <p className="text-base text-ink">{LISTEN_ERROR_MESSAGES.unsupported}</p>
          </Card>
        )}
      </section>

      <Tips />

      <LogSection log={log} supported={supported} standalone={standalone} browser={browser} />
    </>
  );
}

function SupportCard({
  supported,
  standalone,
  browser,
}: {
  supported: boolean;
  standalone: boolean;
  browser: BrowserFamily;
}) {
  return (
    <Card tone={supported ? "sea" : "terracotta"} className="flex flex-col gap-2">
      <h2 className="text-lg font-bold text-ink">Tu dispositivo</h2>
      <ul className="flex flex-col gap-1 text-base text-ink">
        <li>
          <b>Reconocimiento de voz:</b> {supported ? "disponible" : "no disponible en este navegador"}
        </li>
        <li>
          <b>Abierta como:</b> {standalone ? "app instalada (pantalla de inicio)" : "pestaña del navegador"}
        </li>
        <li>
          <b>Navegador:</b> {BROWSER_NAMES[browser]}
        </li>
      </ul>
      {!supported ? <p className="text-sm text-ink">Sin micrófono puedes seguir: en los ejercicios te escuchas y te autoevalúas.</p> : null}
    </Card>
  );
}

function TryCard({
  title,
  locale,
  lang,
  mode = "phrase",
  hint,
  log,
}: {
  title: string;
  locale: string;
  lang: string;
  mode?: ListenMode;
  hint?: string;
  log: readonly SpeechLogEntry[];
}) {
  const listen = useListen({ locale, mode });
  const settled = listen.status === "done" || listen.status === "error";
  const last = settled ? [...log].reverse().find((e) => e.locale === locale && e.mode === mode) : undefined;
  const current = STEPS.findIndex((s) => s.status === listen.status);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-ink">{title}</h3>
        {hint ? <p className="text-sm text-ink">{hint}</p> : null}
        <p className="text-sm text-ink-muted">
          {localeName(locale)} · se para tras {seconds(listen.timings.silenceMs)} de silencio, máximo{" "}
          {duration(listen.timings.maxMs)}.
        </p>
      </div>

      <SpeakPanel listen={listen} lang={lang} idleLabel="Toca y habla" showResult />

      {mode === "answer" && listen.result ? <AnswerStats result={listen.result} /> : null}

      {listen.active || last ? (
        <ol aria-label="Pasos de la escucha" className="flex flex-col gap-1 rounded-button bg-sand p-3 text-sm">
          {STEPS.map((step, i) => {
            const ms = last ? (step.key ? last.timings[step.key] : 0) : undefined;
            const now = !last && i === current;
            const reached = last ? ms !== undefined : i < current;
            return (
              <li key={step.status} className="flex items-center justify-between gap-3">
                <span className={cn(now ? "font-bold text-sea-deep" : reached ? "text-ink" : "text-ink-muted")}>
                  {step.label}
                </span>
                <span className={cn("tabular-nums", now ? "font-bold text-sea-deep" : "text-ink-muted")}>
                  {now ? "ahora" : last ? (ms !== undefined ? seconds(ms) : "no llegó") : reached ? "hecho" : "…"}
                </span>
              </li>
            );
          })}
          {last ? (
            <li className="flex items-center justify-between gap-3 border-t border-line pt-1">
              <span className="font-bold text-ink">Fin: {REASONS[last.reason]}</span>
              <span className="tabular-nums text-ink-muted">
                {last.timings.end !== undefined ? seconds(last.timings.end) : ""}
              </span>
            </li>
          ) : null}
        </ol>
      ) : null}
    </Card>
  );
}

/** After a long answer: words, seconds, words per minute and continuations. */
function AnswerStats({ result }: { result: ListenResult }) {
  const words = result.transcript.split(/\s+/).filter(Boolean).length;
  const wpm = result.durationMs > 0 ? Math.round(words / (result.durationMs / 60_000)) : 0;
  const continuations = result.continuations ?? 0;
  const stats: readonly [string, string][] = [
    ["Palabras", String(words)],
    ["Segundos", seconds(result.durationMs)],
    ["Palabras por minuto", String(wpm)],
    ["Continuaciones", String(continuations)],
  ];
  return (
    <div className="flex flex-col gap-2">
      <dl className="grid grid-cols-2 gap-2">
        {stats.map(([label, value]) => (
          <div key={label} className="flex flex-col rounded-button bg-sand p-3">
            <dt className="text-sm text-ink-muted">{label}</dt>
            <dd className="text-xl font-extrabold tabular-nums text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      {result.continued === "failed" ? (
        <p className="rounded-card bg-terracotta-soft px-4 py-3 text-sm text-terracotta-deep">
          El navegador cortó la escucha y no pudo seguir: se queda lo que dijiste hasta ahí.
        </p>
      ) : null}
    </div>
  );
}

function Tips() {
  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-lg font-bold text-ink">Si no te oye en el iPhone</h2>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-ink">
        <li>
          Permite el micrófono: <b>Ajustes › Apps › Safari › Micrófono</b> → «Permitir».
        </li>
        <li>
          Activa el dictado: <b>Ajustes › Siri</b> (o <b>General › Teclado</b>) → <b>Dictado</b> activado. Sin él, el
          reconocimiento de voz no funciona.
        </li>
        <li>Usa Safari o la app instalada desde Safari: Chrome en iPhone no reconoce la voz.</li>
        <li>Cierra llamadas, notas de voz u otras apps que usen el micrófono.</li>
        <li>Necesitas conexión: el iPhone reconoce la voz por internet.</li>
        <li>Si se queda colgado, cierra la app del todo (desliza hacia arriba) y ábrela otra vez.</li>
      </ul>
    </Card>
  );
}

function LogSection({
  log,
  supported,
  standalone,
  browser,
}: {
  log: readonly SpeechLogEntry[];
  supported: boolean;
  standalone: boolean;
  browser: BrowserFamily;
}) {
  const [notice, setNotice] = useState<string | null>(null);
  const [fallback, setFallback] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const recent = log.slice(-SHOWN).reverse();

  const copy = async () => {
    const json = JSON.stringify(
      { key: SPEECH_LOG_KEY, copiedAt: new Date().toISOString(), supported, standalone, browser, entries: log },
      null,
      2,
    );
    try {
      await navigator.clipboard.writeText(json);
      setFallback(null);
      setNotice("Registro copiado. Pégalo donde quieras compartirlo.");
    } catch {
      setFallback(json);
      setNotice("No he podido copiarlo. Mantén pulsado el texto de abajo para copiarlo a mano.");
    }
  };

  const clear = () => {
    clearSpeechLog();
    setConfirmClear(false);
    setFallback(null);
    setNotice("Registro borrado.");
  };

  return (
    <section aria-labelledby="log-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="log-title" className="text-2xl font-extrabold tracking-tight text-ink">
          Últimos intentos
        </h2>
        <p className="text-sm text-ink-muted">
          Cada vez que usas el micrófono en la app se guarda aquí qué pasó (nunca lo que dijiste). Solo en este móvil.
        </p>
      </div>

      {recent.length === 0 ? (
        <Card>
          <p className="text-base text-ink-muted">Todavía no hay intentos guardados.</p>
        </Card>
      ) : (
        <ol className="flex flex-col gap-2">
          {recent.map((entry, i) => (
            <LogEntry key={`${entry.at}-${i}`} entry={entry} />
          ))}
        </ol>
      )}

      {log.length > SHOWN ? (
        <p className="text-sm text-ink-muted">
          Se muestran los {SHOWN} más recientes de {log.length}. «Copiar registro» los copia todos.
        </p>
      ) : null}

      <p role="status" aria-live="polite" className="text-sm font-bold text-ink empty:hidden">
        {notice}
      </p>
      {fallback ? (
        <textarea
          readOnly
          value={fallback}
          aria-label="Registro en JSON"
          rows={8}
          onFocus={(e) => e.currentTarget.select()}
          className="w-full rounded-button border-2 border-line bg-surface p-3 font-mono text-xs text-ink"
        />
      ) : null}

      <div className="flex flex-col gap-2">
        <Button variant="secondary" size="md" fullWidth onClick={() => void copy()} disabled={log.length === 0}>
          Copiar registro
        </Button>
        {confirmClear ? (
          <div className="flex flex-col gap-2 rounded-card border-2 border-error bg-error-soft p-3">
            <p className="text-sm font-bold text-error-deep">¿Borrar el registro del micrófono? Tu progreso no se toca.</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="md" className="flex-1" onClick={() => setConfirmClear(false)}>
                Cancelar
              </Button>
              <button
                type="button"
                onClick={clear}
                className="pressable inline-flex min-h-12 flex-1 items-center justify-center rounded-button border-2 border-error bg-surface px-5 text-base font-bold text-error-deep [--ledge:var(--error-ledge)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
              >
                Sí, borrar
              </button>
            </div>
          </div>
        ) : (
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={() => {
              setNotice(null);
              setConfirmClear(true);
            }}
            disabled={log.length === 0}
          >
            Borrar registro
          </Button>
        )}
      </div>
    </section>
  );
}

function LogEntry({ entry }: { entry: SpeechLogEntry }) {
  const ok = entry.outcome === "done";
  const t = entry.timings;
  const steps = [
    t.listening !== undefined ? `micrófono abierto a ${seconds(t.listening)}` : null,
    t.hearing !== undefined ? `voz a ${seconds(t.hearing)}` : null,
    t.end !== undefined ? `fin a ${seconds(t.end)}` : null,
  ].filter(Boolean);
  const stepsText = steps.join(", ");
  return (
    <li>
      <Card className="flex flex-col gap-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-sm font-bold",
              ok ? "bg-success-soft text-success-deep" : "bg-error-soft text-error-deep",
            )}
          >
            {ok ? `Te entendió · ${entry.chars} letras` : ERRORS[entry.error ?? "other"]}
          </span>
          <span className="text-xs text-ink-muted">{when(entry.at)}</span>
        </div>
        <p className="text-sm text-ink">
          {localeName(entry.locale)} · {MODE_NAMES[entry.mode] ?? entry.mode} ·{" "}
          {entry.standalone ? "app instalada" : "navegador"}, {BROWSER_NAMES[entry.browser] ?? entry.browser}
          {entry.continuations ? ` · ${entry.continuations} ${entry.continuations === 1 ? "continuación" : "continuaciones"}` : null}
        </p>
        <p className="text-sm text-ink-muted">
          Terminó porque {REASONS[entry.reason] ?? entry.reason}. {stepsText ? `${stepsText.charAt(0).toLocaleUpperCase("es")}${stepsText.slice(1)}.` : null}
        </p>
        {entry.code ? <p className="text-xs text-ink-muted">Código del navegador: {entry.code}</p> : null}
      </Card>
    </li>
  );
}
