"use client";

import { useEffect, useRef, useState } from "react";
import { CloseIcon, MiniPlay, PlayControls } from "@/components/exercises/shared";
import { Button, Card, IconButton, Picture, ProgressBar, TargetText } from "@/components/ui";
import { speak, stop } from "@/lib/audio";
import { getPack, glossOf, languageName } from "@/lib/content";
import { useGlossLang } from "@/lib/content/use-gloss";
import { cn } from "@/lib/cn";
import type { Rng } from "@/lib/exercises";
import {
  POINTS,
  ROUND_MS,
  isPictureQuestion,
  isWord,
  makeQuestion,
  multiplier,
  roundXp,
  saveRecord,
  setupRound,
  type GameCard,
  type Question,
  type TopicPool,
} from "@/lib/game";
import { recordActivity } from "@/lib/progress/activity";

interface Result {
  /** Record before this round. */
  prev: number;
  xp: number;
}

interface RoundState {
  phase: "intro" | "playing" | "end";
  deadline: number;
  cursor: number;
  question: Question | null;
  /** Id of the option tapped for the current question (feedback showing). */
  picked: string | null;
  score: number;
  combo: number;
  bestCombo: number;
  right: number;
  answered: number;
  wrong: GameCard[];
  result: Result | null;
}

const initial: RoundState = {
  phase: "intro",
  deadline: 0,
  cursor: 0,
  question: null,
  picked: null,
  score: 0,
  combo: 0,
  bestCombo: 0,
  right: 0,
  answered: 0,
  wrong: [],
  result: null,
};

const FEEDBACK_RIGHT_MS = 450;
const FEEDBACK_WRONG_MS = 1300;

/** 60-second "Escucha y elige" round with combo multiplier, then the end screen. */
export function Round({
  lang,
  pool,
  deck,
  record,
  onExit,
}: {
  lang: string;
  pool: TopicPool;
  deck: GameCard[];
  /** Current record of the topic. */
  record: number;
  onExit: () => void;
}) {
  const pack = getPack(lang);
  const gloss = useGlossLang(lang);
  const { topic, aliases } = pool;
  const [g, setG] = useState<RoundState>(initial);
  const [now, setNow] = useState(0);
  const rng = useRef<Rng | null>(null);
  const order = useRef<GameCard[]>([]);
  const timeout = useRef<number | undefined>(undefined);
  const live = useRef(false);

  const questionAt = (cursor: number): Question => {
    const r = rng.current!;
    return makeQuestion(order.current[cursor % order.current.length], topic, pack, r, gloss.lang);
  };

  const ask = (q: Question) => {
    if (q.kind === "listen" || q.kind === "listen-picture") speak(q.card, { lang });
    else stop();
  };

  const start = () => {
    const setup = setupRound(topic, deck);
    rng.current = setup.rng;
    order.current = setup.order;
    const question = questionAt(0);
    ask(question);
    live.current = true;
    setNow(setup.startedAt);
    setG({ ...initial, phase: "playing", deadline: setup.deadline, question });
    window.scrollTo(0, 0);
  };

  const finish = (s: RoundState) => {
    live.current = false;
    window.clearTimeout(timeout.current);
    stop();
    const xp = s.answered > 0 ? roundXp(s.right) : 0;
    if (s.answered > 0) {
      const outcomes = s.wrong.flatMap((p) => [p.id, ...(aliases.get(p.id) ?? [])]).map((itemId) => ({ itemId, correct: false }));
      recordActivity({ lang, xp, outcomes });
    }
    const prev = saveRecord(lang, topic.id, s.score);
    setG({ ...s, phase: "end", picked: null, result: { prev, xp } });
  };

  // Clock: redraws the timer and ends the round when time is up.
  useEffect(() => {
    if (g.phase !== "playing") return;
    const id = window.setInterval(() => {
      const t = Date.now();
      if (t >= g.deadline) finish(g);
      else setNow(t);
    }, 200);
    return () => window.clearInterval(id);
  });

  useEffect(
    () => () => {
      live.current = false;
      window.clearTimeout(timeout.current);
      stop();
    },
    [],
  );

  const answer = (option: GameCard) => {
    const q = g.question;
    if (!q || g.picked || g.phase !== "playing") return;
    const correct = option.id === q.card.id;
    const combo = correct ? g.combo + 1 : 0;
    const next: RoundState = {
      ...g,
      picked: option.id,
      score: g.score + (correct ? POINTS * multiplier(g.combo) : 0),
      combo,
      bestCombo: Math.max(g.bestCombo, combo),
      right: g.right + (correct ? 1 : 0),
      answered: g.answered + 1,
      wrong: correct || g.wrong.some((p) => p.id === q.card.id) ? g.wrong : [...g.wrong, q.card],
    };
    setG(next);
    // Wrong after reading the Spanish: hear the right answer (the listening kinds already played it).
    if (!correct && (q.kind === "reverse" || q.kind === "es-picture")) speak(q.card, { lang });
    const cursor = g.cursor + 1;
    const question = questionAt(cursor);
    timeout.current = window.setTimeout(
      () => {
        if (!live.current) return;
        ask(question);
        setG((s) => (s.phase === "playing" ? { ...s, cursor, question, picked: null } : s));
      },
      correct ? FEEDBACK_RIGHT_MS : FEEDBACK_WRONG_MS,
    );
  };

  if (g.phase === "intro") {
    return (
      <div className="flex flex-col gap-5 pb-6">
        <Card tone="terracotta" className="flex flex-col gap-3">
          <p className="text-sm font-bold uppercase tracking-wide text-terracotta-deep">
            {topic.emoji ? `${topic.emoji} ` : ""}
            <span lang={gloss.tag}>{glossOf(topic.title, gloss.lang)}</span>
          </p>
          <h2 className="text-2xl font-extrabold text-ink">Ronda rápida: 60 segundos</h2>
          <p className="text-base text-ink">
            {!topic.phrases.length
              ? "Escucha la palabra o léela en español y elige su imagen."
              : topic.words.length
                ? `Escucha y elige qué significa, lee en español y elige la frase en ${languageName(lang)}, o elige la imagen de cada palabra.`
                : `Escucha y elige qué significa, o lee en español y elige la frase en ${languageName(lang)}.`}{" "}
            Encadena aciertos para multiplicar los puntos.
          </p>
          <p className="text-sm font-bold text-ink-muted">{record ? `Récord: ${record}` : "Aún sin récord"}</p>
        </Card>
        <Button onClick={start}>Empezar</Button>
        <Button variant="secondary" size="md" onClick={onExit}>
          Cambiar de tema
        </Button>
      </div>
    );
  }

  if (g.phase === "end" && g.result) {
    const newRecord = g.score > g.result.prev && g.score > 0;
    return (
      <div className="flex flex-col gap-5 pb-6">
        <Card tone={newRecord ? "lemon" : "default"} className="flex flex-col items-center gap-2 text-center">
          <p className="text-lg font-bold text-ink-muted">¡Tiempo!</p>
          <p className="text-5xl font-extrabold tabular-nums text-ink">{g.score}</p>
          <p className="text-base font-bold text-ink">puntos</p>
          <p className={cn("text-base font-bold", newRecord ? "text-terracotta-deep" : "text-ink-muted")}>
            {newRecord ? "¡Nuevo récord!" : `Récord: ${g.result.prev}`}
          </p>
        </Card>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <Stat label="Aciertos" value={`${g.right}/${g.answered}`} />
          <Stat label="Mejor racha" value={String(g.bestCombo)} />
          <Stat label="XP" value={`+${g.result.xp}`} />
        </dl>
        {g.wrong.length ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-extrabold text-ink">Para repasar</h2>
            <p className="text-sm text-ink-muted">Irán a tu repaso.</p>
            <ul className="flex flex-col gap-2">
              {g.wrong.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-card border-2 border-line bg-surface p-3">
                  <MiniPlay audio={p} label={`Escuchar: ${p.text}`} />
                  {isWord(p) ? <Picture image={p.image} alt="" size="avatar" /> : null}
                  <span className="flex flex-col">
                    <span lang={lang} className="font-bold text-sea-deep">
                      <TargetText text={p.text} lang={lang} />
                    </span>
                    <span lang={gloss.tag} className="text-sm text-ink-muted">
                      {glossOf(p, gloss.lang)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <Button onClick={start}>Otra ronda</Button>
        <Button variant="secondary" size="md" onClick={onExit}>
          Cambiar de tema
        </Button>
      </div>
    );
  }

  const q = g.question;
  if (!q) return null;
  const left = Math.max(0, g.deadline - now);
  const mult = multiplier(g.combo);

  return (
    <div className="flex flex-col gap-5 pb-6">
      <div className="flex items-center gap-3">
        <IconButton
          label="Salir de la ronda"
          icon={<CloseIcon />}
          onClick={() => {
            live.current = false;
            window.clearTimeout(timeout.current);
            stop();
            onExit();
          }}
        />
        <ProgressBar value={left} max={ROUND_MS} label="Tiempo restante" tone={left < 10_000 ? "lemon" : "sea"} className="flex-1" />
        <span className="w-8 text-right text-lg font-extrabold tabular-nums text-ink" aria-hidden="true">
          {Math.ceil(left / 1000)}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-lg font-extrabold tabular-nums text-ink" aria-live="polite">
          {g.score} <span className="text-sm font-bold text-ink-muted">puntos</span>
        </p>
        <p
          className={cn(
            "rounded-full px-3 py-1 text-sm font-extrabold tabular-nums",
            mult > 1 ? "bg-terracotta text-on-accent" : "bg-sand text-ink-muted",
          )}
        >
          x{mult} · racha {g.combo}
        </p>
      </div>

      {q.kind === "listen" || q.kind === "listen-picture" ? (
        <>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink">
            {q.kind === "listen" ? "Escucha y elige qué significa" : "Escucha y elige la imagen"}
          </h2>
          <PlayControls audio={q.card} />
        </>
      ) : q.kind === "es-picture" ? (
        <h2 className="text-2xl font-extrabold tracking-tight text-ink">
          ¿Cuál es{" "}
          <span lang={gloss.tag} className="text-sea-deep">
            «{glossOf(q.card, gloss.lang)}»
          </span>
          ?
        </h2>
      ) : (
        <>
          <h2 className="text-2xl font-extrabold tracking-tight text-ink">¿Cómo se dice en {languageName(lang)}?</h2>
          <p lang={gloss.tag} className="text-2xl font-bold text-sea-deep">
            {glossOf(q.card, gloss.lang)}
          </p>
        </>
      )}

      {isPictureQuestion(q.kind) ? (
        <ul className="mx-auto grid w-full max-w-xs grid-cols-2 gap-3">
          {q.options.map((option) => {
            if (!isWord(option)) return null;
            const reveal = g.picked !== null && option.id === q.card.id;
            const isPicked = g.picked === option.id;
            return (
              <li key={option.id} className="flex">
                <button
                  type="button"
                  disabled={g.picked !== null}
                  onClick={() => answer(option)}
                  className={cn(
                    "pressable relative w-full overflow-hidden rounded-card border-2",
                    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
                    reveal
                      ? "border-success [--ledge:var(--success)]"
                      : isPicked
                        ? "border-error [--ledge:var(--error)]"
                        : "border-line [--ledge:var(--line)]",
                    g.picked !== null && !reveal && !isPicked && "opacity-60",
                  )}
                >
                  {/* Listening: the Spanish name; reading the Spanish: the target-language word (the answer stays a test). */}
                  <Picture image={option.image} alt={q.kind === "listen-picture" ? glossOf(option, gloss.lang) : option.text} bordered={false} />
                  {reveal || isPicked ? (
                    <span
                      lang={lang}
                      aria-hidden="true"
                      className={cn(
                        "absolute inset-x-0 bottom-0 px-2 py-1.5 text-center text-base font-bold",
                        reveal ? "bg-success-soft text-success-deep" : "bg-error-soft text-error-deep",
                      )}
                    >
                      <TargetText text={option.text} lang={lang} />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="flex flex-col gap-3">
          {q.options.map((option) => {
            const isRight = option.id === q.card.id;
            const reveal = g.picked !== null && isRight;
            const isPicked = g.picked === option.id;
            const label = q.kind === "listen" ? glossOf(option, gloss.lang) : option.text;
            return (
              <li key={option.id} className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={g.picked !== null}
                  onClick={() => answer(option)}
                  lang={q.kind === "reverse" ? lang : gloss.tag}
                  className={cn(
                    "pressable min-h-14 flex-1 rounded-button border-2 px-4 py-3 text-left text-lg font-bold",
                    "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
                    reveal
                      ? "border-success bg-success-soft text-success-deep [--ledge:var(--success)]"
                      : isPicked
                        ? "border-error bg-error-soft text-error-deep [--ledge:var(--error)]"
                        : "border-line bg-surface text-ink [--ledge:var(--line)]",
                    g.picked !== null && !reveal && !isPicked && "opacity-60",
                  )}
                >
                  {q.kind === "reverse" ? <TargetText text={label} lang={lang} /> : label}
                </button>
                {q.kind === "reverse" ? <MiniPlay audio={option} label={`Escuchar: ${option.text}`} /> : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-card border-2 border-line bg-surface p-3">
      <dt className="text-xs font-bold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="text-xl font-extrabold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
