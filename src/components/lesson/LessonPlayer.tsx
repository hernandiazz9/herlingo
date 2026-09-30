"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { CloseIcon, ExerciseView, GrammarTip, LessonLangContext } from "@/components/exercises";
import { Button, Card, ProgressBar } from "@/components/ui";
import { speak, stop } from "@/lib/audio";
import { DEFAULT_LANG, getLesson, getPack, getUnit, type Lesson } from "@/lib/content";
import {
  buildResult,
  generateSession,
  recordOutcome,
  type ExerciseOutcome,
  type ItemOutcome,
  type LessonResult,
  type SessionStep,
} from "@/lib/exercises";
import { getSettings } from "@/lib/progress/settings";
import {
  isSpeakingPaused,
  pauseSpeaking,
  resumeSpeaking,
  speakingPausedUntil,
  subscribeSpeakingPause,
} from "@/lib/speech";
import { ExitDialog } from "./ExitDialog";
import { FeedbackSheet } from "./FeedbackSheet";

/** A wrong exercise comes back at the end of the session at most this many times. */
export const MAX_RETRIES = 2;

export interface LessonPlayerProps {
  lessonId?: string;
  /** Ad-hoc lesson (e.g. a review session) instead of `lessonId`. */
  lesson?: Lesson;
  lang?: string;
  /** Fixed seed (same session every time); by default each start gets a new one. */
  seed?: string;
  /** Called once when the lesson is finished. Persist progress here (T07). */
  onComplete?: (result: LessonResult) => void;
  /** Where "exit" and the final "Continuar" go. */
  exitHref?: string;
  /** Called instead of navigating to `exitHref`. */
  onExit?: () => void;
  /** Graded exercises wanted (default: by lesson size). */
  sessionSize?: number;
  /** Intro copy under the title (default: the lesson one). */
  intro?: string;
}

interface Entry {
  step: SessionStep;
  attempt: number;
  /** Unique per attempt: resets the exercise component on retries. */
  uid: string;
}

type Phase = { name: "intro" } | { name: "run" } | { name: "done"; result: LessonResult };

interface RunData {
  seed: string;
  startedAt: number;
  firstTry: Set<string>;
  items: Map<string, ItemOutcome>;
}

const noPause = () => 0;
/** Only called from event handlers (the session clock). */
const now = () => Date.now();

/** Full-screen lesson session: intro → exercises with feedback → result with XP. */
export function LessonPlayer({ lessonId, lesson: adHoc, lang = DEFAULT_LANG, seed, onComplete, exitHref = "/", onExit, sessionSize, intro }: LessonPlayerProps) {
  const router = useRouter();
  const pack = getPack(lang);
  const lesson = adHoc ?? (lessonId ? getLesson(lessonId, pack) : undefined);
  const unit = lesson ? getUnit(lesson.unitId, pack) : undefined;

  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const [queue, setQueue] = useState<Entry[]>([]);
  const [pos, setPos] = useState(0);
  const [outcome, setOutcome] = useState<ExerciseOutcome | null>(null);
  const [resolved, setResolved] = useState<string[]>([]);
  // Speaking exercises dropped by "No puedo hablar ahora" (not counted unless already resolved).
  const [skipped, setSkipped] = useState<string[]>([]);
  const [confirmExit, setConfirmExit] = useState(false);
  const run = useRef<RunData>({ seed: "", startedAt: 0, firstTry: new Set(), items: new Map() });
  const pausedUntil = useSyncExternalStore(subscribeSpeakingPause, speakingPausedUntil, noPause);

  if (!lesson) return null;

  const entry = phase.name === "run" ? queue[pos] : undefined;
  const gradedKeys = countedKeys(queue, skipped, resolved);

  /** Plays the prompt audio of listening exercises; called from the click that shows them (iOS). */
  const autoplay = (e: Entry | undefined) => {
    const s = e?.step;
    if (!s) return;
    if (s.type === "listen-meaning" || s.type === "dictation") void speak(s.audio, { lang });
    else if (s.type === "answer") void speak(s.question, { lang });
  };

  const start = () => {
    const s = seed ?? String(now());
    const steps = generateSession(lesson, pack, { seed: s, speaking: getSettings().speaking && !isSpeakingPaused(), size: sessionSize });
    const q = steps.map((step) => ({ step, attempt: 0, uid: step.key }));
    run.current = { seed: s, startedAt: now(), firstTry: new Set(), items: new Map() };
    setQueue(q);
    setPos(0);
    setOutcome(null);
    setResolved([]);
    setSkipped([]);
    if (!q.length) {
      finish(q, [], []);
      return;
    }
    setPhase({ name: "run" });
    autoplay(q[0]);
  };

  const finish = (q: Entry[], skippedKeys: string[], resolvedKeys: string[]) => {
    stop();
    const keys = countedKeys(q, skippedKeys, resolvedKeys);
    const result = buildResult({
      lessonId: lesson.id,
      lang,
      seed: run.current.seed,
      startedAt: run.current.startedAt,
      finishedAt: now(),
      exercises: keys.size,
      firstTryCorrect: [...keys].filter((k) => run.current.firstTry.has(k)).length,
      items: run.current.items,
    });
    onComplete?.(result);
    setPhase({ name: "done", result });
  };

  const advance = (q: Entry[], next: number, skippedKeys = skipped, resolvedKeys = resolved) => {
    setOutcome(null);
    if (next >= q.length) {
      finish(q, skippedKeys, resolvedKeys);
      return;
    }
    setQueue(q);
    setPos(next);
    autoplay(q[next]);
  };

  const answer = (o: ExerciseOutcome) => {
    if (!entry || entry.step.type === "grammar" || outcome) return;
    const step = entry.step;
    recordOutcome(run.current.items, step, o);
    if (entry.attempt === 0 && o.correct && !o.wrongItemIds?.length) run.current.firstTry.add(step.key);
    if ((o.correct || entry.attempt >= MAX_RETRIES) && !resolved.includes(step.key)) {
      setResolved([...resolved, step.key]);
    }
    setOutcome(o);
  };

  const next = () => {
    if (!entry) return;
    let q = queue;
    if (outcome && !outcome.correct && entry.attempt < MAX_RETRIES) {
      const attempt = entry.attempt + 1;
      q = [...queue, { step: entry.step, attempt, uid: `${entry.step.key}#${attempt}` }];
    }
    advance(q, pos + 1);
  };

  const cannotSpeak = () => {
    pauseSpeaking();
    stop();
    const rest = queue.slice(pos);
    const dropped = rest.filter((e) => e.step.type === "speak").map((e) => e.step.key);
    const q = [...queue.slice(0, pos), ...rest.filter((e) => e.step.type !== "speak")];
    const skippedKeys = [...skipped, ...dropped];
    setSkipped(skippedKeys);
    advance(q, pos, skippedKeys);
  };

  const leave = () => {
    stop();
    if (onExit) onExit();
    else router.push(exitHref);
  };

  const requestExit = () => (phase.name === "run" ? setConfirmExit(true) : leave());

  return (
    <LessonLangContext.Provider value={lang}>
      <div className="fixed inset-0 z-[60] flex justify-center bg-backdrop">
        <div className="relative flex w-full max-w-[var(--column-width)] flex-col overflow-hidden bg-cream pt-[calc(var(--safe-top)+0.75rem)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          <header className="flex items-center gap-3 px-4 py-2">
            <button
              type="button"
              aria-label="Salir de la lección"
              title="Salir de la lección"
              onClick={requestExit}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-sand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
            >
              <CloseIcon className="size-7" />
            </button>
            <ProgressBar
              label="Progreso de la lección"
              value={phase.name === "done" ? 1 : phase.name === "run" ? resolved.length : 0}
              max={phase.name === "run" ? Math.max(1, gradedKeys.size) : 1}
              tone={phase.name === "done" ? "success" : "lemon"}
            />
          </header>

          <div className="flex flex-1 flex-col overflow-y-auto px-5 pt-4 pb-[calc(var(--safe-bottom)+1.5rem)]">
            {phase.name === "intro" ? (
              <div className="flex flex-1 flex-col gap-5">
                <p className="text-sm font-bold uppercase tracking-wider text-terracotta-deep">
                  {unit?.emoji ? `${unit.emoji} ` : ""}
                  {unit?.title}
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight text-ink">{lesson.title}</h1>
                <p className="text-lg text-ink-muted">
                  {intro ??
                    "Unos 5 minutos: escuchar, entender, construir frases y decirlas en voz alta. Los fallos vuelven al final."}
                </p>
                {pausedUntil ? (
                  <Card tone="lemon" className="flex flex-col gap-3">
                    <p className="text-base text-ink">
                      Los ejercicios de hablar están en pausa hasta las{" "}
                      <strong>
                        {new Date(pausedUntil).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })}
                      </strong>
                      .
                    </p>
                    <Button size="md" variant="secondary" onClick={resumeSpeaking}>
                      Ya puedo hablar
                    </Button>
                  </Card>
                ) : null}
                <div className="mt-auto">
                  <Button fullWidth onClick={start}>
                    Empezar
                  </Button>
                </div>
              </div>
            ) : null}

            {entry ? (
              entry.step.type === "grammar" ? (
                <GrammarTip key={entry.uid} card={entry.step.card} onContinue={() => advance(queue, pos + 1)} />
              ) : (
                <>
                  {entry.attempt > 0 ? (
                    <p className="mb-3 self-start rounded-full bg-terracotta-soft px-3 py-1 text-sm font-bold text-terracotta-deep">
                      Otra vez
                    </p>
                  ) : null}
                  <ExerciseView
                    key={entry.uid}
                    exercise={entry.step}
                    answered={outcome !== null}
                    onAnswer={answer}
                    onCannotSpeak={cannotSpeak}
                  />
                  {outcome ? <div aria-hidden="true" className="h-64 shrink-0" /> : null}
                </>
              )
            ) : null}

            {phase.name === "done" ? <LessonDone result={phase.result} onContinue={leave} onRepeat={start} /> : null}
          </div>

          {entry && entry.step.type !== "grammar" && outcome ? (
            <FeedbackSheet exercise={entry.step} outcome={outcome} seq={pos} onContinue={next} />
          ) : null}
          {confirmExit ? (
            <ExitDialog
              onStay={() => setConfirmExit(false)}
              onLeave={() => {
                setConfirmExit(false);
                leave();
              }}
            />
          ) : null}
        </div>
      </div>
    </LessonLangContext.Provider>
  );
}

/** Graded exercise keys that count for progress and results. */
function countedKeys(q: Entry[], skipped: string[], resolved: string[]): Set<string> {
  const keys = new Set<string>();
  for (const e of q) {
    if (e.step.type === "grammar") continue;
    if (skipped.includes(e.step.key) && !resolved.includes(e.step.key)) continue;
    keys.add(e.step.key);
  }
  return keys;
}

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function LessonDone({ result, onContinue, onRepeat }: { result: LessonResult; onContinue: () => void; onRepeat: () => void }) {
  const perfect = result.exercises > 0 && result.firstTryCorrect === result.exercises;
  return (
    <div className="flex flex-1 flex-col items-center gap-6 text-center">
      <p className="pt-6 text-6xl" aria-hidden="true">
        {perfect ? "🏆" : "🍋"}
      </p>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">¡Lección completada!</h1>
      <p className="text-lg text-ink-muted">{perfect ? "Sin un solo fallo. ¡Bravissimo!" : "Los fallos también enseñan. ¡Sigue así!"}</p>
      <div className="grid w-full grid-cols-3 gap-3">
        <Card tone="lemon" className="flex flex-col items-center gap-1 p-3">
          <span className="text-2xl font-extrabold text-ink">+{result.xp}</span>
          <span className="text-sm font-bold text-ink-muted">XP</span>
        </Card>
        <Card tone="sea" className="flex flex-col items-center gap-1 p-3">
          <span className="text-2xl font-extrabold text-ink">
            {result.firstTryCorrect}/{result.exercises}
          </span>
          <span className="text-sm font-bold text-ink-muted">a la primera</span>
        </Card>
        <Card tone="terracotta" className="flex flex-col items-center gap-1 p-3">
          <span className="text-2xl font-extrabold text-ink">{formatDuration(result.durationMs)}</span>
          <span className="text-sm font-bold text-ink-muted">tiempo</span>
        </Card>
      </div>
      <div className="mt-auto flex w-full flex-col gap-3">
        <Button fullWidth onClick={onContinue}>
          Continuar
        </Button>
        <Button fullWidth variant="secondary" onClick={onRepeat}>
          Repetir lección
        </Button>
      </div>
    </div>
  );
}
