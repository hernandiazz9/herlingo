"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { LessonLangContext, PlayControls } from "@/components/exercises";
import { LiveTranscript, MicButton, useListen } from "@/components/speech";
import { Button, Card, TargetText } from "@/components/ui";
import { stop } from "@/lib/audio";
import {
  COACH_LIMITS,
  interviewStep,
  questionPlayable,
  toCoachApiError,
  type CoachApiError,
  type CoachAssessment,
  type CoachLevel,
  type InterviewQuestion,
  type InterviewTurn,
} from "@/lib/coach";
import { useCoachAccess, useCoachUsage, useLearnerProfile } from "@/lib/coach/use-coach";
import { coachAvailable } from "@/lib/coach/available";
import { getPack } from "@/lib/content";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { recordActivity } from "@/lib/progress/activity";
import { CoachCodeForm, useHydrated } from "./AiUsagePanel";
import { CoachUnavailable } from "./shared";

/** XP for finishing the level interview. */
const XP_INTERVIEW = 15;

/** Route of the interview (linked from /perfil and Prepárate). */
export const LEVEL_INTERVIEW_HREF = "/preparar/nivel/";

const LEVEL_NAMES: Record<CoachLevel, string> = {
  A0: "Empiezas de cero",
  A1: "Principiante",
  A2: "Básico",
  B1: "Intermedio",
  B2: "Intermedio alto",
  C1: "Avanzado",
  C2: "Dominio",
};

const DONT_KNOW = "No lo sé.";
const SPANISH_LOCALE = "es-ES";

export function formatAssessmentDate(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
}

/** Level badge, summary, strengths, weak points and (optionally) what the learner told. */
export function AssessmentDetails({ assessment, date, showFacts = true }: { assessment: CoachAssessment; date?: string; showFacts?: boolean }) {
  const when = date ? formatAssessmentDate(date) : "";
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-sea text-2xl font-extrabold text-on-accent">
          {assessment.level}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xl font-extrabold text-ink">{LEVEL_NAMES[assessment.level]}</span>
          {when ? <span className="text-sm text-ink-muted">Entrevista del {when}</span> : null}
        </span>
      </div>
      <p className="text-base text-ink">{assessment.summary}</p>
      <DetailList title="Lo que haces bien" items={assessment.strengths} />
      <DetailList title="Lo que te cuesta" items={assessment.weakPoints} />
      {showFacts ? <DetailList title="Lo que la IA sabe de ti" items={assessment.facts} /> : null}
    </div>
  );
}

function DetailList({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-base text-ink">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

type Phase =
  | { name: "intro" }
  | { name: "waiting"; history: InterviewTurn[] }
  | { name: "question"; history: InterviewTurn[]; question: InterviewQuestion; turn: number }
  | { name: "error"; history: InterviewTurn[]; error: CoachApiError }
  | { name: "done"; assessment: CoachAssessment };

/**
 * The AI level interview, question by question: typed answers (dictation where the browser
 * supports it), then the assessment, stored on the device for the next pack requests. Repeatable.
 */
export function LevelInterview() {
  const lang = useScreenLang();
  if (lang && !coachAvailable(lang)) return <CoachUnavailable />;
  return lang ? <Interview key={lang} lang={lang} /> : null;
}

function Interview({ lang }: { lang: string }) {
  const router = useRouter();
  const hydrated = useHydrated();
  const { hasCode } = useCoachAccess();
  const { latest, saveAssessment } = useLearnerProfile(lang);
  const { usage } = useCoachUsage({ refreshOnMount: false });
  const [phase, setPhase] = useState<Phase>({ name: "intro" });
  const request = useRef<AbortController | null>(null);

  useEffect(
    () => () => {
      request.current?.abort();
      stop();
    },
    [],
  );

  const leave = () => {
    request.current?.abort();
    stop();
    if (window.history.length > 1) router.back();
    else router.push("/perfil/");
  };

  const ask = (history: InterviewTurn[]) => {
    stop();
    request.current?.abort();
    const ctrl = new AbortController();
    request.current = ctrl;
    setPhase({ name: "waiting", history });
    interviewStep(lang, history, { signal: ctrl.signal }).then(
      (result) => {
        if (ctrl.signal.aborted) return;
        if (result.done) {
          saveAssessment(result.assessment);
          recordActivity({ lang, xp: XP_INTERVIEW, outcomes: [], source: "coach" });
          setPhase({ name: "done", assessment: result.assessment });
        } else {
          setPhase({ name: "question", history, question: result.question, turn: result.turn });
        }
      },
      (e: unknown) => {
        const error = toCoachApiError(e);
        if (error.kind !== "aborted" && !ctrl.signal.aborted) setPhase({ name: "error", history, error });
      },
    );
  };

  if (!hydrated) return null;

  if (phase.name === "intro") {
    return (
      <div className="flex flex-1 flex-col gap-5">
        <Card tone="lemon" className="flex flex-col gap-2">
          <p className="text-lg font-bold text-ink">Unas 8 preguntas, unos 5 minutos</p>
          <p className="text-base text-ink">
            Entender frases, contestar en {getPack(lang).meta.name.toLowerCase()} y contarme tu viaje. Escribe o dicta
            tus respuestas. Al final verás tu nivel y la IA lo tendrá en cuenta al preparar tus situaciones.
          </p>
          <p className="text-sm text-ink-muted">
            Cuenta como una generación de hoy
            {usage && usage.today.limit ? ` (llevas ${usage.today.used} de ${usage.today.limit})` : ""}.
          </p>
        </Card>
        {latest ? (
          <p className="text-base text-ink-muted">
            Tu último resultado: <b className="text-ink">{latest.level}</b>, el {formatAssessmentDate(latest.date)}.
          </p>
        ) : null}
        {hasCode ? (
          <div className="mt-auto flex flex-col gap-3 pt-2">
            <Button fullWidth onClick={() => ask([])}>
              {latest ? "Repetir la entrevista" : "Empezar la entrevista"}
            </Button>
            <Button fullWidth variant="secondary" onClick={leave}>
              Ahora no
            </Button>
          </div>
        ) : (
          <Card>
            <CoachCodeForm intro="Para hablar con la IA necesitas tu código de acceso." />
          </Card>
        )}
      </div>
    );
  }

  if (phase.name === "waiting") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center" aria-live="polite" aria-busy="true">
        <span aria-hidden="true" className="size-12 animate-spin rounded-full border-4 border-sea-soft border-t-sea motion-reduce:animate-none" />
        <p className="text-lg font-bold text-ink">
          {phase.history.length ? "Pensando la siguiente pregunta…" : "Preparando la primera pregunta…"}
        </p>
      </div>
    );
  }

  if (phase.name === "error") {
    const { error, history } = phase;
    const canRetry = error.kind !== "limit";
    return (
      <div className="flex flex-1 flex-col gap-5">
        <p role="alert" className="rounded-card bg-error-soft p-4 text-base font-bold text-error-deep">
          {error.message}
        </p>
        {error.kind === "unauthorized" && !hasCode ? (
          <Card>
            <CoachCodeForm intro="Vuelve a escribir tu código de acceso y reintenta." />
          </Card>
        ) : null}
        <div className="mt-auto flex flex-col gap-3 pt-2">
          {canRetry ? (
            <Button fullWidth disabled={!hasCode} onClick={() => ask(history)}>
              Reintentar
            </Button>
          ) : null}
          <Button fullWidth variant={canRetry ? "secondary" : "primary"} onClick={leave}>
            Salir
          </Button>
        </div>
      </div>
    );
  }

  if (phase.name === "done") {
    return (
      <div className="flex flex-1 flex-col gap-5">
        <p className="text-sm font-bold uppercase tracking-wider text-terracotta-deep">Entrevista terminada</p>
        <p className="text-xl font-extrabold text-success-deep">+{XP_INTERVIEW} XP</p>
        <Card tone="sea">
          <AssessmentDetails assessment={phase.assessment} />
        </Card>
        <p className="text-base text-ink-muted">
          Lo tendré en cuenta al preparar tus situaciones. Puedes repetir la entrevista cuando quieras desde tu perfil.
        </p>
        <div className="mt-auto pt-2">
          <Button fullWidth onClick={leave}>
            Listo
          </Button>
        </div>
      </div>
    );
  }

  const { history, question, turn } = phase;
  return (
    <LessonLangContext.Provider value={lang}>
      <QuestionStep
        key={turn}
        lang={lang}
        turn={turn}
        question={question}
        onAnswer={(answer) => ask([...history, { question, answer }])}
        onLeave={leave}
      />
    </LessonLangContext.Provider>
  );
}

const KIND_LABELS: Record<InterviewQuestion["kind"], string> = {
  comprehension: "Escucha y entiende",
  reply: "Contesta",
  personal: "Sobre ti",
};

function QuestionStep({
  lang,
  turn,
  question,
  onAnswer,
  onLeave,
}: {
  lang: string;
  turn: number;
  question: InterviewQuestion;
  onAnswer: (answer: string) => void;
  onLeave: () => void;
}) {
  const { meta } = getPack(lang);
  const [answer, setAnswer] = useState("");
  const [showText, setShowText] = useState(question.kind !== "comprehension");
  const playable = questionPlayable(lang, question);
  const target = meta.name.toLowerCase();
  // Comprehension is answered in Spanish; a reply in the target language; a personal question in the language it was asked.
  const answerInSpanish = question.kind === "comprehension" || (question.kind === "personal" && !question.text);
  const placeholder =
    question.kind === "comprehension"
      ? "Escribe en español qué significa…"
      : question.kind === "reply"
        ? `Escribe tu respuesta en ${target}…`
        : "Escribe tu respuesta…";

  // Dictation (long answers): what is heard is appended to what is typed and stays editable.
  const listen = useListen({
    locale: answerInSpanish ? SPANISH_LOCALE : meta.speechLocale,
    mode: "long",
    onResult: (r) =>
      setAnswer((a) => (a.trim() ? `${a.trimEnd()} ${r.transcript}` : r.transcript).slice(0, COACH_LIMITS.description)),
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!answer.trim()) return;
    listen.cancel();
    onAnswer(answer.trim());
  };

  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-5">
      <p className="text-sm font-bold uppercase tracking-wider text-terracotta-deep">
        Pregunta {turn} · {KIND_LABELS[question.kind]}
      </p>
      <h2 className="text-2xl font-extrabold tracking-tight text-ink">{question.prompt}</h2>
      {question.text ? (
        <Card className="flex flex-col gap-3">
          {playable ? <PlayControls audio={playable} size="md" /> : null}
          {showText ? (
            <p lang={meta.lang} className="text-xl font-bold text-ink">
              <TargetText text={question.text} lang={meta.lang} />
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setShowText(true)}
              className="self-start text-base font-bold text-sea underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
            >
              Ver el texto
            </button>
          )}
        </Card>
      ) : null}
      <label className="flex flex-col gap-2">
        <span className="sr-only">Tu respuesta</span>
        <textarea
          lang={answerInSpanish ? "es" : meta.lang}
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          maxLength={COACH_LIMITS.description}
          rows={3}
          autoComplete="off"
          placeholder={placeholder}
          className="w-full resize-none rounded-card border-2 border-line bg-surface p-4 text-lg text-ink placeholder:text-ink-muted focus:border-sea focus:outline-none"
        />
      </label>
      {listen.supported ? (
        <div className="flex flex-col items-start gap-2">
          <MicButton
            listen={listen}
            size="sm"
            idleLabel={answerInSpanish ? "Dictar en español" : `Dictar en ${target}`}
            disabled={!listen.active && answer.length >= COACH_LIMITS.description}
          />
          <LiveTranscript listen={listen} lang={answerInSpanish ? "es" : meta.lang} align="start" />
        </div>
      ) : null}
      <div className="mt-auto flex flex-col gap-3 pt-2">
        <Button type="submit" fullWidth disabled={!answer.trim()}>
          Enviar
        </Button>
        <Button
          fullWidth
          variant="secondary"
          onClick={() => {
            listen.cancel();
            onAnswer(DONT_KNOW);
          }}
        >
          No lo sé
        </Button>
        <button
          type="button"
          onClick={onLeave}
          className="self-center text-base font-bold text-ink-muted underline underline-offset-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
        >
          Salir sin terminar
        </button>
      </div>
    </form>
  );
}
