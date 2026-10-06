"use client";

import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SpeakerIcon } from "@/components/icons";
import { EyeIcon, MicIcon, SlowIcon } from "@/components/phrasebook/icons";
import { Button, Picture } from "@/components/ui";
import { speak, stop } from "@/lib/audio";
import { cn } from "@/lib/cn";
import {
  getPack,
  type Dialogue,
  type LearnerOption,
  type LearnerTurn,
  type NativeTurn,
  type ImageRef,
  type Playable,
} from "@/lib/content";
import { bestMatch, canRecognize, listen } from "./recognition";

type Verdict = LearnerOption["verdict"];

const VERDICT: Record<Verdict, { title: string; box: string; titleClass: string }> = {
  correct: { title: "¡Genial!", box: "border-success bg-success-soft", titleClass: "text-success-deep" },
  acceptable: { title: "Se entiende", box: "border-lemon bg-lemon-soft", titleClass: "text-ink" },
  wrong: { title: "Mejor no", box: "border-error bg-error-soft", titleClass: "text-error-deep" },
};

const noSubscribe = () => () => {};

function shuffled(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function correctOption(turn: LearnerTurn): LearnerOption {
  return turn.options.find((o) => o.verdict === "correct") ?? turn.options[0];
}

interface Attempt {
  option: number;
  heard?: string;
}

/** Result of a finished dialogue: learner turns whose first answer was not wrong, of `total`. */
export interface DialogueScore {
  firstTry: number;
  total: number;
}

function score(turns: LearnerTurn[], attempts: Record<string, Attempt[]>): DialogueScore {
  const firstTry = turns.filter((t) => {
    const first = attempts[t.id]?.[0];
    return first !== undefined && t.options[first.option]?.verdict !== "wrong";
  }).length;
  return { firstTry, total: turns.length };
}

export interface DialoguePlayerProps {
  dialogue: Dialogue;
  /** Language pack for audio, speech recognition and the native speaker's default name. */
  lang: string;
  /** Contents of the intro card (what the dialogue is about). */
  intro: ReactNode;
  /** The summary's second button, beside "Repetir". */
  exit: ReactNode;
  /** Called from the tap that opens the summary, every time the dialogue is finished. */
  onFinish?: (score: DialogueScore) => void;
  /** Shown under the score in the summary. */
  summary?: ReactNode;
}

/** Plays a scripted dialogue turn by turn; the learner picks or says each answer. */
export function DialoguePlayer({ dialogue, lang, intro, exit, onFinish, summary }: DialoguePlayerProps) {
  const { meta } = getPack(lang);
  const turns = dialogue.turns;
  const locale = meta.speechLocale;
  const native = meta.name;

  const [phase, setPhase] = useState<"intro" | "running" | "done">("intro");
  const [pos, setPos] = useState(0);
  const [orders, setOrders] = useState<Record<string, number[]>>({});
  const [attempts, setAttempts] = useState<Record<string, Attempt[]>>({});
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  const [listening, setListening] = useState(false);
  const [micMessage, setMicMessage] = useState<string | null>(null);
  const cancelListen = useRef<(() => void) | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const micAvailable = useSyncExternalStore(noSubscribe, canRecognize, () => false);

  useEffect(() => {
    if (phase === "running") bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [phase, pos, attempts]);

  useEffect(
    () => () => {
      cancelListen.current?.();
      stop();
    },
    [],
  );

  const learnerTurns = turns.filter((t): t is LearnerTurn => t.speaker === "learner");
  const current = turns[pos];
  const lastAttempt = current ? attempts[current.id]?.at(-1) : undefined;

  /** Moves past turn `i`, playing the next native line (call from a gesture). */
  function advanceFrom(i: number) {
    setMicMessage(null);
    const j = i + 1;
    if (j >= turns.length) {
      stop();
      setPhase("done");
      onFinish?.(score(learnerTurns, attempts));
      window.scrollTo({ top: 0 });
      return;
    }
    const next = turns[j];
    if (next.speaker === "native") {
      speak(next, { lang });
      setPos(j + 1 < turns.length && turns[j + 1].speaker === "learner" ? j + 1 : j);
    } else {
      setPos(j);
    }
  }

  function start() {
    setOrders(Object.fromEntries(learnerTurns.map((t) => [t.id, shuffled(t.options.length)])));
    setAttempts({});
    setRevealed(new Set());
    setPhase("running");
    setPos(0);
    advanceFrom(-1);
  }

  function answer(turn: LearnerTurn, option: number, heard?: string) {
    if (!heard) speak(turn.options[option], { lang });
    setMicMessage(null);
    setAttempts((prev) => ({ ...prev, [turn.id]: [...(prev[turn.id] ?? []), { option, heard }] }));
  }

  function retry(turn: LearnerTurn) {
    stop();
    // Keep the attempts (the score counts the first one); an undefined option re-opens the choices.
    setAttempts((prev) => ({ ...prev, [turn.id]: [...(prev[turn.id] ?? []), { option: -1 }] }));
  }

  function mic(turn: LearnerTurn) {
    if (listening) {
      cancelListen.current?.();
      return;
    }
    stop();
    setMicMessage(null);
    setListening(true);
    const { result, cancel } = listen(locale);
    cancelListen.current = cancel;
    void result.then((heard) => {
      cancelListen.current = null;
      setListening(false);
      const idx = bestMatch(
        heard,
        turn.options.map((o) => o.text),
      );
      if (idx >= 0) answer(turn, idx, heard[0]);
      else
        setMicMessage(
          heard[0]
            ? `He oído «${heard[0]}», que no se parece a ninguna respuesta. Prueba otra vez o elige una.`
            : "No te he oído bien. Prueba otra vez o elige una respuesta.",
        );
    });
  }

  const toggleReveal = (turnId: string) =>
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(turnId)) next.delete(turnId);
      else next.add(turnId);
      return next;
    });

  if (phase === "intro") {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-2 rounded-card border-2 border-sea/30 bg-sea-soft p-5">{intro}</div>
        <p className="text-base text-ink-muted">
          Sube el volumen. Escucharás a un {native.toLowerCase()} y tendrás que elegir{micAvailable ? " o decir" : ""} tu
          respuesta. El texto está oculto: toca «Ver texto» si lo necesitas.
        </p>
        <Button onClick={start} fullWidth>
          Empezar
        </Button>
      </div>
    );
  }

  if (phase === "done") {
    const { firstTry } = score(learnerTurns, attempts);
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-card border-2 border-success bg-success-soft p-5 text-center">
          <p className="text-2xl font-extrabold text-success-deep">¡Diálogo completado!</p>
          <p className="text-ink">
            Has acertado {firstTry} de {learnerTurns.length} a la primera.
          </p>
          {summary}
        </div>
        <h2 className="text-lg font-extrabold text-ink">Transcripción</h2>
        <ol className="flex flex-col gap-3">
          {turns.map((turn) =>
            turn.speaker === "native" ? (
              <li key={turn.id}>
                <WithAvatar avatar={turn.avatar} compact>
                  <TranscriptLine who={turn.name ?? native} item={turn} es={turn.es} side="left" lang={meta.lang} />
                </WithAvatar>
              </li>
            ) : (
              <li key={turn.id} className="flex flex-col gap-2">
                <p className="text-right text-sm text-ink-muted">{turn.prompt}</p>
                <FinalAnswer turn={turn} attempts={attempts[turn.id] ?? []} lang={meta.lang} />
              </li>
            ),
          )}
        </ol>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={start}>
            Repetir
          </Button>
          {exit}
        </div>
      </div>
    );
  }

  const choosing = current?.speaker === "learner" && (lastAttempt === undefined || lastAttempt.option < 0);

  return (
    <div className="flex flex-col gap-4">
      <ol className="flex flex-col gap-4">
        {turns.slice(0, pos + 1).map((turn, i) => {
          if (turn.speaker === "native") {
            return (
              <li key={turn.id}>
                <WithAvatar avatar={turn.avatar}>
                  <NativeBubble
                    turn={turn}
                    name={turn.name ?? native}
                    lang={meta.lang}
                    shown={revealed.has(turn.id)}
                    onToggle={() => toggleReveal(turn.id)}
                  />
                </WithAvatar>
              </li>
            );
          }
          const tries = (attempts[turn.id] ?? []).filter((a) => a.option >= 0);
          const last = attempts[turn.id]?.at(-1);
          const isCurrent = i === pos;
          if (isCurrent && choosing) return null;
          const shownTries = isCurrent ? tries : tries.slice(-1);
          return (
            <li key={turn.id} className="flex flex-col gap-2">
              {shownTries.map((a, k) => (
                <AnswerFeedback
                  key={k}
                  turn={turn}
                  attempt={a}
                  lang={meta.lang}
                  compact={!isCurrent || k < shownTries.length - 1}
                />
              ))}
              {isCurrent && last && last.option >= 0 && turn.options[last.option].verdict === "wrong" ? (
                <button type="button" onClick={() => retry(turn)} className="self-start font-bold text-sea underline">
                  Intentarlo otra vez
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>

      {choosing && current?.speaker === "learner" ? (
        <div className="flex flex-col gap-3 rounded-card border-2 border-line bg-surface p-4">
          <p className="text-sm font-bold tracking-wide text-ink-muted uppercase">Tu turno</p>
          <p className="text-lg font-bold text-ink">{current.prompt}</p>
          <div className="flex flex-col gap-2">
            {(orders[current.id] ?? current.options.map((_, k) => k)).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => answer(current, k)}
                lang={meta.lang}
                className="pressable min-h-14 rounded-button border-2 border-line bg-surface px-4 py-3 text-left text-lg font-bold text-ink [--ledge:var(--line)]"
              >
                {current.options[k].text}
              </button>
            ))}
          </div>
          {micAvailable ? (
            <button
              type="button"
              onClick={() => mic(current)}
              aria-pressed={listening}
              className={cn(
                "pressable inline-flex min-h-12 items-center justify-center gap-2 rounded-button px-4 font-bold",
                listening
                  ? "bg-terracotta text-on-accent [--ledge:var(--terracotta-ledge)]"
                  : "border-2 border-line bg-surface text-terracotta-deep [--ledge:var(--line)]",
              )}
            >
              <MicIcon width={20} height={20} /> {listening ? "Escuchando… (toca para parar)" : "O dilo en voz alta"}
            </button>
          ) : null}
          {micMessage ? (
            <p className="text-sm text-ink-muted" role="status">
              {micMessage}
            </p>
          ) : null}
        </div>
      ) : null}

      {!choosing ? (
        <Button onClick={() => advanceFrom(pos)} fullWidth>
          {pos >= turns.length - 1 ? "Ver resumen" : "Continuar"}
        </Button>
      ) : null}
      <div ref={bottom} />
    </div>
  );
}

function PlayButtons({ item, lang }: { item: Playable; lang: string }) {
  return (
    <span className="flex shrink-0 gap-1">
      <button
        type="button"
        onClick={() => speak(item, { lang })}
        aria-label="Escuchar otra vez"
        className="inline-flex size-11 items-center justify-center rounded-full bg-sea text-on-accent"
      >
        <SpeakerIcon width={22} height={22} />
      </button>
      <button
        type="button"
        onClick={() => speak(item, { lang, slow: true })}
        aria-label="Escuchar despacio"
        className="inline-flex size-11 items-center justify-center rounded-full border-2 border-line bg-surface text-sea"
      >
        <SlowIcon width={22} height={22} />
      </button>
    </span>
  );
}

/**
 * The native speaker's avatar beside their bubble (left, top-aligned). Decorative: the speaker's
 * name is written in the bubble. No avatar = the bubble alone, as before.
 */
function WithAvatar({ avatar, compact, children }: { avatar?: ImageRef; compact?: boolean; children: ReactNode }) {
  if (!avatar) return children;
  return (
    <div className="flex items-start gap-2">
      <Picture image={avatar} alt="" size="avatar" className={compact ? "mt-1" : "mt-2"} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function NativeBubble({
  turn,
  name,
  lang,
  shown,
  onToggle,
}: {
  turn: NativeTurn;
  name: string;
  lang: string;
  shown: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mr-8 flex flex-col gap-2 rounded-card rounded-tl-md border-2 border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-terracotta-deep">{name}</p>
        <PlayButtons item={turn} lang={lang} />
      </div>
      {shown ? (
        <div>
          <p lang={lang} className="text-lg font-bold text-ink">
            {turn.text}
          </p>
          <p className="text-ink-muted">{turn.es}</p>
        </div>
      ) : (
        <p className="text-ink-muted" aria-hidden="true">
          ● ● ●
        </p>
      )}
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={shown}
        className="inline-flex items-center gap-1.5 self-start text-sm font-bold text-sea"
      >
        <EyeIcon off={shown} width={18} height={18} /> {shown ? "Ocultar texto" : "Ver texto"}
      </button>
    </div>
  );
}

function AnswerFeedback({
  turn,
  attempt,
  lang,
  compact,
}: {
  turn: LearnerTurn;
  attempt: Attempt;
  lang: string;
  compact: boolean;
}) {
  const option = turn.options[attempt.option];
  const v = VERDICT[option.verdict];
  const ideal = correctOption(turn);
  return (
    <div className="flex flex-col gap-2">
      <div className="ml-8 flex items-start gap-2 rounded-card rounded-tr-md border-2 border-sea/30 bg-sea-soft p-4">
        <div className="flex-1">
          {attempt.heard ? <p className="text-xs text-ink-muted">Has dicho: «{attempt.heard}»</p> : null}
          <p lang={lang} className="text-lg font-bold text-ink">
            {option.text}
          </p>
          <p className="text-ink-muted">{option.es}</p>
        </div>
        <PlayButtons item={option} lang={lang} />
      </div>
      {compact ? null : (
        <div className={cn("flex flex-col gap-1 rounded-card border-2 p-4", v.box)} role="status">
          <p className={cn("text-lg font-extrabold", v.titleClass)}>{v.title}</p>
          <p className="text-ink">{option.feedback}</p>
          {option.verdict !== "correct" ? (
            <p className="text-ink">
              Lo ideal:{" "}
              <button type="button" lang={lang} onClick={() => speak(ideal, { lang })} className="font-bold underline">
                {ideal.text}
              </button>
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

function FinalAnswer({ turn, attempts, lang }: { turn: LearnerTurn; attempts: Attempt[]; lang: string }) {
  const done = attempts.filter((a) => a.option >= 0);
  const last = done.at(-1);
  const option = last ? turn.options[last.option] : undefined;
  const ideal = correctOption(turn);
  return (
    <>
      {option ? (
        <TranscriptLine who="Tú" item={option} es={option.es} side="right" verdict={option.verdict} lang={lang} />
      ) : null}
      {option?.verdict !== "correct" ? (
        <TranscriptLine who="Lo ideal" item={ideal} es={ideal.es} side="right" verdict="correct" lang={lang} />
      ) : null}
    </>
  );
}

function TranscriptLine({
  who,
  item,
  es,
  side,
  verdict,
  lang,
}: {
  who: string;
  item: Playable;
  es: string;
  side: "left" | "right";
  verdict?: Verdict;
  lang: string;
}) {
  const mark = verdict === "correct" ? "✓" : verdict === "acceptable" ? "≈" : verdict === "wrong" ? "✗" : null;
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-card border-2 p-3",
        side === "left" ? "mr-8 border-line bg-surface" : "ml-8 border-sea/30 bg-sea-soft",
      )}
    >
      <div className="flex-1">
        <p className="text-xs font-bold text-ink-muted">
          {who}
          {mark ? (
            <span
              className={cn(
                "ml-2",
                verdict === "correct" ? "text-success-deep" : verdict === "wrong" ? "text-error-deep" : "text-ink",
              )}
            >
              {mark}
            </span>
          ) : null}
        </p>
        <p lang={lang} className="font-bold text-ink">
          {item.text}
        </p>
        <p className="text-sm text-ink-muted">{es}</p>
      </div>
      <PlayButtons item={item} lang={lang} />
    </div>
  );
}
