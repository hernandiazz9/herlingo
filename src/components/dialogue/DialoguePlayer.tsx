"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { SpeakerIcon } from "@/components/icons";
import { EyeIcon, SlowIcon } from "@/components/phrasebook/icons";
import { SpeakPanel, useListen, WordFeedback } from "@/components/speech";
import { Button, Picture, TargetText } from "@/components/ui";
import { speak, stop } from "@/lib/audio";
import { cn } from "@/lib/cn";
import {
  getPack,
  glossOf,
  type Dialogue,
  type LearnerOption,
  type LearnerTurn,
  type NativeTurn,
  type ImageRef,
  type Playable,
} from "@/lib/content";
import { useGlossLang } from "@/lib/content/use-gloss";
import { useLearnCopy } from "@/lib/i18n/use-learn-copy";
import { bestOption, type SpeechScore } from "@/lib/speech";

type Verdict = LearnerOption["verdict"];

const VERDICT: Record<Verdict, { box: string; titleClass: string }> = {
  correct: { box: "border-success bg-success-soft", titleClass: "text-success-deep" },
  acceptable: { box: "border-lemon bg-lemon-soft", titleClass: "text-ink" },
  wrong: { box: "border-error bg-error-soft", titleClass: "text-error-deep" },
};

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
  const gloss = useGlossLang(lang);
  const copy = useLearnCopy();
  const turns = dialogue.turns;
  const locale = meta.speechLocale;

  const [phase, setPhase] = useState<"intro" | "running" | "done">("intro");
  const [pos, setPos] = useState(0);
  const [orders, setOrders] = useState<Record<string, number[]>>({});
  const [attempts, setAttempts] = useState<Record<string, Attempt[]>>({});
  const [revealed, setRevealed] = useState<Set<string>>(() => new Set());
  /** The closest option when what was said matched none (word feedback), for the current turn. */
  const [miss, setMiss] = useState<SpeechScore | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  // One mic for the learner's turn: the option that scores best (and passes) is the answer.
  // Options are read when the session settles, so this always sees the current turn.
  const listen = useListen({
    locale,
    onResult: (r) => {
      const turn = turns[pos];
      if (phase !== "running" || turn?.speaker !== "learner") return;
      const { index, result } = bestOption(
        turn.options.map((o) => o.text),
        r.alternatives.length ? r.alternatives : [r.transcript],
        meta,
      );
      if (index >= 0) answer(turn, index, result?.heard || r.transcript);
      else setMiss(result);
    },
  });
  const micAvailable = listen.supported;

  useEffect(() => {
    if (phase === "running") bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [phase, pos, attempts, miss]);

  // useListen cancels its own session on unmount.
  useEffect(() => () => stop(), []);

  const learnerTurns = turns.filter((t): t is LearnerTurn => t.speaker === "learner");
  const current = turns[pos];
  const lastAttempt = current ? attempts[current.id]?.at(-1) : undefined;

  /** Moves past turn `i`, playing the next native line (call from a gesture). */
  function advanceFrom(i: number) {
    listen.reset();
    setMiss(null);
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
    // A tap always works: it discards any open mic session first.
    if (!heard) {
      listen.reset();
      speak(turn.options[option], { lang });
    }
    setMiss(null);
    setAttempts((prev) => ({ ...prev, [turn.id]: [...(prev[turn.id] ?? []), { option, heard }] }));
  }

  function retry(turn: LearnerTurn) {
    stop();
    listen.reset();
    setMiss(null);
    // Keep the attempts (the score counts the first one); an undefined option re-opens the choices.
    setAttempts((prev) => ({ ...prev, [turn.id]: [...(prev[turn.id] ?? []), { option: -1 }] }));
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
          {copy.dialogueIntro(micAvailable)}
        </p>
        <Button onClick={start} fullWidth>
          {copy.start}
        </Button>
      </div>
    );
  }

  if (phase === "done") {
    const { firstTry } = score(learnerTurns, attempts);
    return (
      <div className="flex flex-col gap-5">
        <div className="rounded-card border-2 border-success bg-success-soft p-5 text-center">
          <p className="text-2xl font-extrabold text-success-deep">{copy.dialogueDone}</p>
          <p className="text-ink">
            {copy.dialogueScore(firstTry, learnerTurns.length)}
          </p>
          {summary}
        </div>
        <h2 className="text-lg font-extrabold text-ink">{copy.transcript}</h2>
        <ol className="flex flex-col gap-3">
          {turns.map((turn) =>
            turn.speaker === "native" ? (
              <li key={turn.id}>
                <WithAvatar avatar={turn.avatar} compact>
                  <TranscriptLine who={turn.name ?? meta.name} item={turn} side="left" lang={meta.lang} />
                </WithAvatar>
              </li>
            ) : (
              <li key={turn.id} className="flex flex-col gap-2">
                <p lang={gloss.tag} className="text-right text-sm text-ink-muted">
                  {glossOf(turn.prompt, gloss.lang)}
                </p>
                <FinalAnswer turn={turn} attempts={attempts[turn.id] ?? []} lang={meta.lang} />
              </li>
            ),
          )}
        </ol>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="secondary" onClick={start}>
            {copy.repeat}
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
                    name={turn.name ?? meta.name}
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
                  {copy.tryAgain}
                </button>
              ) : null}
            </li>
          );
        })}
      </ol>

      {choosing && current?.speaker === "learner" ? (
        <div className="flex flex-col gap-3 rounded-card border-2 border-line bg-surface p-4">
          <p className="text-sm font-bold tracking-wide text-ink-muted uppercase">{copy.yourTurn}</p>
          <p lang={gloss.tag} className="text-lg font-bold text-ink">
            {glossOf(current.prompt, gloss.lang)}
          </p>
          <div className="flex flex-col gap-2">
            {(orders[current.id] ?? current.options.map((_, k) => k)).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => answer(current, k)}
                lang={meta.lang}
                className="pressable min-h-14 rounded-button border-2 border-line bg-surface px-4 py-3 text-left text-lg font-bold text-ink [--ledge:var(--line)]"
              >
                <TargetText text={current.options[k].text} lang={meta.lang} />
              </button>
            ))}
          </div>
          {miss && !listen.active ? (
            <div className="flex flex-col gap-2 rounded-card border-2 border-line bg-sand p-3" role="status">
              <p className="text-base text-ink">
                {copy.missHeard[0]}<span lang={meta.lang}>{miss.heard}</span>{copy.missHeard[1]}
              </p>
              <WordFeedback words={miss.words} lang={meta.lang} />
              <p className="text-sm text-ink-muted">{copy.missHint}</p>
            </div>
          ) : null}
          <SpeakPanel
            listen={listen}
            lang={meta.lang}
            idleLabel={miss ? copy.sayAgain : copy.orSayIt}
            className="pt-1"
          />
        </div>
      ) : null}

      {!choosing ? (
        <Button onClick={() => advanceFrom(pos)} fullWidth>
          {pos >= turns.length - 1 ? copy.seeSummary : copy.continue}
        </Button>
      ) : null}
      <div ref={bottom} />
    </div>
  );
}

function PlayButtons({ item, lang }: { item: Playable; lang: string }) {
  const copy = useLearnCopy();
  return (
    <span className="flex shrink-0 gap-1">
      <button
        type="button"
        onClick={() => speak(item, { lang })}
        aria-label={copy.listenAgain}
        className="inline-flex size-11 items-center justify-center rounded-full bg-sea text-on-accent"
      >
        <SpeakerIcon width={22} height={22} />
      </button>
      <button
        type="button"
        onClick={() => speak(item, { lang, slow: true })}
        aria-label={copy.listenSlowly}
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
  const gloss = useGlossLang(lang);
  const copy = useLearnCopy();
  return (
    <div className="mr-8 flex flex-col gap-2 rounded-card rounded-tl-md border-2 border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-terracotta-deep">{name}</p>
        <PlayButtons item={turn} lang={lang} />
      </div>
      {shown ? (
        <div>
          <p lang={lang} className="text-lg font-bold text-ink">
            <TargetText text={turn.text} lang={lang} />
          </p>
          <p lang={gloss.tag} className="text-ink-muted">
            {glossOf(turn, gloss.lang)}
          </p>
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
        <EyeIcon off={shown} width={18} height={18} /> {shown ? copy.hideText : copy.showText}
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
  const copy = useLearnCopy();
  const gloss = useGlossLang(lang);
  return (
    <div className="flex flex-col gap-2">
      <div className="ml-8 flex items-start gap-2 rounded-card rounded-tr-md border-2 border-sea/30 bg-sea-soft p-4">
        <div className="flex-1">
          {attempt.heard ? <p className="text-xs text-ink-muted">{copy.youSaid(attempt.heard)}</p> : null}
          <p lang={lang} className="text-lg font-bold text-ink">
            <TargetText text={option.text} lang={lang} />
          </p>
          <p lang={gloss.tag} className="text-ink-muted">
            {glossOf(option, gloss.lang)}
          </p>
        </div>
        <PlayButtons item={option} lang={lang} />
      </div>
      {compact ? null : (
        <div className={cn("flex flex-col gap-1 rounded-card border-2 p-4", v.box)} role="status">
          <p className={cn("text-lg font-extrabold", v.titleClass)}>{copy.verdicts[option.verdict]}</p>
          <p lang={gloss.tag} className="text-ink">
            {glossOf(option.feedback, gloss.lang)}
          </p>
          {option.verdict !== "correct" ? (
            <p className="text-ink">
              {copy.ideal}:{" "}
              <button type="button" lang={lang} onClick={() => speak(ideal, { lang })} className="text-left align-top font-bold underline">
                <TargetText text={ideal.text} lang={lang} />
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
  const copy = useLearnCopy();
  return (
    <>
      {option ? (
        <TranscriptLine who={copy.you} item={option} side="right" verdict={option.verdict} lang={lang} />
      ) : null}
      {option?.verdict !== "correct" ? (
        <TranscriptLine who={copy.ideal} item={ideal} side="right" verdict="correct" lang={lang} />
      ) : null}
    </>
  );
}

function TranscriptLine({
  who,
  item,
  side,
  verdict,
  lang,
}: {
  who: string;
  /** Played and shown with its translation in the learner's gloss language. */
  item: Playable;
  side: "left" | "right";
  verdict?: Verdict;
  lang: string;
}) {
  const gloss = useGlossLang(lang);
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
          <TargetText text={item.text} lang={lang} />
        </p>
        <p lang={gloss.tag} className="text-sm text-ink-muted">
          {glossOf(item, gloss.lang)}
        </p>
      </div>
      <PlayButtons item={item} lang={lang} />
    </div>
  );
}
