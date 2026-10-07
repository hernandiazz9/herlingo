"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { ChoiceExercise, CloseIcon, FillGapExercise, LessonLangContext, MatchExercise, MiniPlay } from "@/components/exercises";
import { ExitDialog, FeedbackSheet } from "@/components/lesson";
import { Button, Card, ProgressBar, TargetText } from "@/components/ui";
import { speak, stop } from "@/lib/audio";
import { getItem, getPack, getStories, type Story, type StoryKeyword } from "@/lib/content";
import { recordOutcome, type Exercise, type ExerciseOutcome, type ItemOutcome } from "@/lib/exercises";
import { recordActivity } from "@/lib/progress/activity";
import { buildStoryGames, markStoryDone, storyHref, storyXp, type StoryGame, type StoryStep } from "@/lib/stories";
import { OrderExercise } from "./OrderExercise";
import { QuestionExercise } from "./QuestionExercise";

type Phase = { name: "intro" } | { name: "run" } | { name: "done"; summary: Summary };

interface Summary {
  xp: number;
  right: number;
  total: number;
  /** Key words answered wrong at least once (they go to spaced review). */
  wrong: StoryKeyword[];
  played: number;
}

interface RunData {
  items: Map<string, ItemOutcome>;
  right: number;
  total: number;
  played: Set<string>;
  recorded: boolean;
}

/** The games after reading (each skippable), then a summary that records the activity. */
export function StoryGames({ story, lang, onExit }: { story: Story; lang: string; onExit: () => void }) {
  const pack = getPack(lang);
  const [games] = useState<StoryGame[]>(() => buildStoryGames(story, String(Date.now()), pack));
  const [gameIdx, setGameIdx] = useState(0);
  const [stepIdx, setStepIdx] = useState(0);
  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const [outcome, setOutcome] = useState<ExerciseOutcome | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const run = useRef<RunData>({ items: new Map(), right: 0, total: 0, played: new Set(), recorded: false });

  const game = games[gameIdx];
  const step = phase.name === "run" ? game?.steps[stepIdx] : undefined;
  const stories = getStories(pack);
  const next = stories[stories.findIndex((s) => s.id === story.id) + 1];

  /** Plays the prompt of listening steps; called from the click that shows them (iOS). */
  const autoplay = (s: StoryStep | undefined) => {
    if (s?.type === "listen-meaning") void speak(s.audio, { lang });
    else if (s?.type === "answer") void speak(s.question, { lang });
  };

  const finish = () => {
    stop();
    const r = run.current;
    const outcomes = [...r.items.values()];
    const xp = storyXp(r.right);
    if (!r.recorded) {
      r.recorded = true;
      // Every practised key word: wrong ones back to box 1 (due now), right ones up a box.
      recordActivity({ xp, lang, outcomes: outcomes.map((o) => ({ itemId: o.itemId, correct: o.mistakes === 0 })) });
      markStoryDone(lang, story.id);
    }
    const wrong = outcomes
      .filter((o) => o.mistakes > 0)
      .map((o) => getItem(o.itemId, pack))
      .filter((x): x is StoryKeyword => x?.kind === "vocab" || x?.kind === "phrase" || x?.kind === "expression");
    setPhase({ name: "done", summary: { xp, right: r.right, total: r.total, wrong, played: r.played.size } });
  };

  const goToGame = (i: number) => {
    setOutcome(null);
    setStepIdx(0);
    if (i >= games.length) {
      finish();
      return;
    }
    setGameIdx(i);
    setPhase({ name: "intro" });
  };

  const startGame = () => {
    run.current.played.add(game.id);
    setStepIdx(0);
    setOutcome(null);
    setPhase({ name: "run" });
    autoplay(game.steps[0]);
  };

  const advance = () => {
    setOutcome(null);
    const n = stepIdx + 1;
    if (n >= game.steps.length) {
      goToGame(gameIdx + 1);
      return;
    }
    setStepIdx(n);
    autoplay(game.steps[n]);
  };

  const answer = (o: ExerciseOutcome) => {
    if (!step || step.type === "order" || outcome) return;
    recordOutcome(run.current.items, step, o);
    run.current.total += 1;
    if (o.correct && !o.wrongItemIds?.length) run.current.right += 1;
    setOutcome(o);
  };

  const orderDone = (mistakes: number) => {
    run.current.total += 1;
    if (mistakes === 0) run.current.right += 1;
    advance();
  };

  const leave = () => {
    stop();
    onExit();
  };

  const view = (s: StoryStep) => {
    const props = { answered: outcome !== null, onAnswer: answer };
    switch (s.type) {
      case "match":
        return <MatchExercise exercise={s} {...props} />;
      case "listen-meaning":
      case "read-meaning":
        return <ChoiceExercise exercise={s} {...props} />;
      case "fill-gap":
        return <FillGapExercise exercise={s} {...props} />;
      case "answer":
        return <QuestionExercise exercise={s} {...props} />;
      case "order":
        return <OrderExercise step={s} onDone={orderDone} />;
      default:
        return null;
    }
  };

  const total = game?.steps.length ?? 1;
  const progress = phase.name === "done" ? 1 : phase.name === "run" ? stepIdx + (outcome ? 1 : 0) : 0;

  return (
    <LessonLangContext.Provider value={lang}>
      <div className="fixed inset-0 z-[60] flex justify-center bg-backdrop">
        <div className="relative flex w-full max-w-[var(--column-width)] flex-col overflow-hidden bg-cream pt-[calc(var(--safe-top)+0.75rem)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
          <header className="flex items-center gap-3 px-4 py-2">
            <button
              type="button"
              aria-label="Salir de los juegos"
              title="Salir de los juegos"
              onClick={() => (phase.name === "done" ? leave() : setConfirmExit(true))}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-sand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
            >
              <CloseIcon className="size-7" />
            </button>
            <ProgressBar
              label="Progreso del juego"
              value={progress}
              max={phase.name === "done" ? 1 : total}
              tone={phase.name === "done" ? "success" : "lemon"}
            />
          </header>

          <div className="flex flex-1 flex-col overflow-y-auto px-5 pt-4 pb-[calc(var(--safe-bottom)+1.5rem)]">
            {phase.name === "intro" && game ? (
              <div className="flex flex-1 flex-col gap-5">
                <p className="text-sm font-bold uppercase tracking-wider text-terracotta-deep">
                  Juego {gameIdx + 1} de {games.length}
                </p>
                <h1 className="text-3xl font-extrabold tracking-tight text-ink">{game.title}</h1>
                <p className="text-lg text-ink-muted">{game.description}</p>
                <div className="mt-auto flex flex-col gap-3">
                  <Button fullWidth onClick={startGame}>
                    Empezar
                  </Button>
                  <Button fullWidth variant="secondary" onClick={() => goToGame(gameIdx + 1)}>
                    Saltar este juego
                  </Button>
                </div>
              </div>
            ) : null}

            {phase.name === "intro" && !game ? (
              <div className="flex flex-1 flex-col gap-5">
                <p className="text-lg text-ink-muted">Esta historia no tiene juegos todavía.</p>
                <Button fullWidth onClick={finish}>
                  Terminar
                </Button>
              </div>
            ) : null}

            {step ? (
              <>
                {!outcome ? (
                  <button
                    type="button"
                    onClick={() => {
                      stop();
                      goToGame(gameIdx + 1);
                    }}
                    className="mb-3 self-end text-sm font-bold text-sea underline underline-offset-4"
                  >
                    Saltar juego
                  </button>
                ) : null}
                <div key={`${game.id}:${step.key}`}>{view(step)}</div>
                {outcome ? <div aria-hidden="true" className="h-64 shrink-0" /> : null}
              </>
            ) : null}

            {phase.name === "done" ? (
              <StoryDone
                summary={phase.summary}
                story={story}
                lang={lang}
                nextHref={next ? storyHref(next.id) : undefined}
                onReread={leave}
              />
            ) : null}
          </div>

          {step && step.type !== "order" && outcome ? (
            <FeedbackSheet exercise={step as Exercise} outcome={outcome} seq={stepIdx} onContinue={advance} />
          ) : null}
          {confirmExit ? (
            <ExitDialog
              title="¿Salir de la historia?"
              description="Si sales ahora, perderás lo que llevas de esta historia."
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

function StoryDone({
  summary,
  story,
  lang,
  nextHref,
  onReread,
}: {
  summary: Summary;
  story: Story;
  lang: string;
  nextHref?: string;
  onReread: () => void;
}) {
  const perfect = summary.total > 0 && summary.right === summary.total;
  return (
    <div className="flex flex-1 flex-col items-center gap-6 text-center">
      <p className="pt-6 text-6xl" aria-hidden="true">
        {perfect ? "🏆" : (story.emoji ?? "📖")}
      </p>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">¡Historia completada!</h1>
      <p className="text-lg text-ink-muted">
        {summary.played === 0 ? "Has leído la historia." : perfect ? "Sin un solo fallo. ¡Bravissimo!" : "Los fallos también enseñan. ¡Sigue así!"}
      </p>
      <div className="grid w-full grid-cols-2 gap-3">
        <Card tone="lemon" className="flex flex-col items-center gap-1 p-3">
          <span className="text-2xl font-extrabold text-ink">+{summary.xp}</span>
          <span className="text-sm font-bold text-ink-muted">XP</span>
        </Card>
        <Card tone="sea" className="flex flex-col items-center gap-1 p-3">
          <span className="text-2xl font-extrabold text-ink">
            {summary.right}/{summary.total}
          </span>
          <span className="text-sm font-bold text-ink-muted">a la primera</span>
        </Card>
      </div>
      {summary.wrong.length ? (
        <Card className="flex w-full flex-col gap-3 text-left">
          <p className="text-base font-bold text-ink">Palabras para repasar</p>
          <p className="text-sm text-ink-muted">Volverán en Repaso para que no se te olviden.</p>
          <ul className="flex flex-col gap-2">
            {summary.wrong.map((item) => (
              <li key={item.id} className="flex items-center gap-3">
                <MiniPlay audio={item} label={`Escuchar: ${item.text}`} />
                <span className="flex min-w-0 flex-col">
                  <span lang={lang} className="text-base font-bold text-ink">
                    <TargetText text={item.text} lang={lang} />
                  </span>
                  <span className="text-sm text-ink-muted">{item.es}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
      <div className="mt-auto flex w-full flex-col gap-3">
        {nextHref ? (
          <Link
            href={nextHref}
            className="pressable inline-flex min-h-14 w-full items-center justify-center rounded-button bg-sea px-6 text-lg font-bold tracking-wide text-on-accent [--ledge:var(--sea-ledge)]"
          >
            Siguiente historia
          </Link>
        ) : null}
        <Link
          href="/historias/"
          className="pressable inline-flex min-h-14 w-full items-center justify-center rounded-button border-2 border-line bg-surface px-6 text-lg font-bold tracking-wide text-sea [--ledge:var(--line)]"
        >
          Volver a Historias
        </Link>
        <Button fullWidth variant="secondary" onClick={onReread}>
          Leer otra vez
        </Button>
      </div>
    </div>
  );
}
