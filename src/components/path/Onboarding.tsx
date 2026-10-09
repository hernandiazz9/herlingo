"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { CloseIcon, PlayControls } from "@/components/exercises";
import { Button, Card, ProgressBar, TargetText } from "@/components/ui";
import { speak, stop } from "@/lib/audio";
import { getLesson, getLevels, getPack, glossOf, type Level, type PlacementQuestion } from "@/lib/content";
import { useGlossLang } from "@/lib/content/use-gloss";
import { setActiveLang } from "@/lib/content/active";
import { setLevel, suggestLevel } from "@/lib/content/level";
import { LevelChips } from "@/components/level/LevelChips";
import { useActiveLang, useScreenLang } from "@/lib/content/use-active-lang";
import { LanguagePicker, pickablePacks } from "@/components/language/LanguagePicker";
import { cn } from "@/lib/cn";
import { applyPlacement, completeOnboarding, getProgress } from "@/lib/progress";
import { recordActivity } from "@/lib/progress/activity";

/** XP for finishing the placement test, plus one per right answer. */
const XP_PLACEMENT = 10;

type Phase =
  | { name: "welcome" }
  | { name: "test"; index: number; answers: boolean[] }
  | { name: "result"; right: number; lessons: string[]; suggested: Level | null; level: Level | null };

/** Lessons passed: every question that lists the lesson was answered right. */
function masteredLessons(questions: PlacementQuestion[], answers: boolean[]): string[] {
  const ok = new Map<string, boolean>();
  questions.forEach((q, i) => {
    for (const id of q.lessons) ok.set(id, (ok.get(id) ?? true) && answers[i] === true);
  });
  return [...ok].filter(([, v]) => v).map(([id]) => id);
}

/**
 * First launch: a short welcome, then the placement test (~12 questions, ~3 minutes) that marks
 * the lessons you already master as done. `retake` starts straight at the test (from /perfil).
 */
export function Onboarding({ retake = false }: { retake?: boolean }) {
  const router = useRouter();
  const { ready, lang: active } = useActiveLang();
  const lang = useScreenLang();
  // Chosen here: also covers a browser that cannot store the choice (the picker would loop).
  const [chosen, setChosen] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const canPick = !retake && pickablePacks().length > 1;

  if (!ready || !lang) return null;
  // First launch (no language yet) or "Cambiar de idioma": the picker comes before the welcome.
  if (canPick && (picking || (!active && !chosen))) {
    return (
      <LanguageChoice
        current={active ?? chosen}
        onChoose={(l) => {
          setActiveLang(l);
          // Already studying it: straight to its route.
          if (getProgress(l).onboarded) return router.replace("/");
          setChosen(l);
          setPicking(false);
        }}
      />
    );
  }
  const shown = active ?? chosen ?? lang;
  return <Placement key={shown} lang={shown} retake={retake} onChangeLanguage={canPick ? () => setPicking(true) : undefined} />;
}

function LanguageChoice({ current, onChoose }: { current: string | null; onChoose: (lang: string) => void }) {
  return (
    <div className="flex flex-1 flex-col gap-5">
      <p aria-hidden="true" className="pt-4 text-6xl">
        🌍
      </p>
      <h1 className="text-3xl font-extrabold tracking-tight text-ink">¿Qué idioma quieres aprender?</h1>
      <p className="text-lg text-ink">Elige uno para empezar. Puedes cambiarlo cuando quieras desde tu perfil o tu ruta.</p>
      <LanguagePicker current={current} onChoose={onChoose} label="Idiomas que puedes estudiar" />
    </div>
  );
}

function Placement({ lang, retake, onChangeLanguage }: { lang: string; retake: boolean; onChangeLanguage?: () => void }) {
  const router = useRouter();
  const pack = getPack(lang);
  const gloss = useGlossLang(lang);
  const questions = pack.placement;
  const [phase, setPhase] = useState<Phase>(retake && questions.length ? { name: "test", index: 0, answers: [] } : { name: "welcome" });

  const play = (q: PlacementQuestion | undefined) => {
    if (q?.audio) void speak(q.audio, { lang });
  };

  const startTest = () => {
    setPhase({ name: "test", index: 0, answers: [] });
    play(questions[0]);
  };

  const skip = () => {
    completeOnboarding(lang);
    router.replace("/");
  };

  const answer = (right: boolean) => {
    if (phase.name !== "test") return;
    const answers = [...phase.answers, right];
    const next = phase.index + 1;
    if (next < questions.length) {
      setPhase({ name: "test", index: next, answers });
      play(questions[next]);
      return;
    }
    stop();
    const lessons = masteredLessons(questions, answers);
    applyPlacement(lang, lessons);
    const rightCount = answers.filter(Boolean).length;
    recordActivity({ lang, xp: XP_PLACEMENT + rightCount, outcomes: [], source: "placement" });
    const suggested = suggestLevel(getLevels(pack), questions, answers);
    setPhase({ name: "result", right: rightCount, lessons, suggested, level: suggested });
  };

  if (phase.name === "welcome") {
    return (
      <div className="flex flex-1 flex-col gap-5">
        <p aria-hidden="true" className="pt-4 text-6xl">
          🍋
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">¡Hola! Vamos a por el {pack.meta.name.toLowerCase()}</h1>
        <p className="text-lg text-ink">
          Lecciones cortas, de unos 5 minutos, por situaciones. Repaso de lo que fallas y un frasario para usar en la
          calle.
        </p>
        {questions.length ? (
          <Card tone="lemon" className="flex flex-col gap-2">
            <p className="text-lg font-bold text-ink">Primero, una prueba rápida</p>
            <p className="text-base text-ink">
              {questions.length} preguntas, unos 3 minutos. Lo que ya sepas quedará marcado como hecho y empezarás donde te
              toca.
            </p>
          </Card>
        ) : null}
        <div className="mt-auto flex flex-col gap-3 pt-4">
          {questions.length ? (
            <Button fullWidth onClick={startTest}>
              Hacer la prueba
            </Button>
          ) : null}
          <Button fullWidth variant={questions.length ? "secondary" : "primary"} onClick={skip}>
            Empezar desde cero
          </Button>
          {onChangeLanguage ? (
            <Button fullWidth variant="secondary" onClick={onChangeLanguage}>
              {pack.meta.emoji ? `${pack.meta.emoji} ` : ""}Cambiar de idioma
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  if (phase.name === "result") {
    const titles = phase.lessons.flatMap((id) => {
      const lesson = getLesson(id, pack);
      return lesson ? [glossOf(lesson.title, gloss.lang)] : [];
    });
    const levels = getLevels(pack);
    const finish = () => {
      // The suggested (or chosen) level is stored only when confirmed here.
      if (phase.level) setLevel(lang, phase.level);
      router.replace("/");
    };
    return (
      <div className="flex flex-1 flex-col gap-5">
        <p aria-hidden="true" className="pt-4 text-6xl">
          {phase.right >= questions.length / 2 ? "🏆" : "🌱"}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">
          {phase.right} de {questions.length} bien
        </h1>
        <p className="text-xl font-extrabold text-success-deep">+{XP_PLACEMENT + phase.right} XP</p>
        {titles.length ? (
          <Card tone="sea" className="flex flex-col gap-2">
            <p className="text-base font-bold text-ink">
              {titles.length === 1 ? "Hemos marcado como hecha esta lección:" : `Hemos marcado como hechas ${titles.length} lecciones:`}
            </p>
            <ul lang={gloss.tag} className="flex list-disc flex-col gap-1 pl-5 text-base text-ink">
              {titles.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </Card>
        ) : (
          <p className="text-lg text-ink">Empezarás desde el principio: así no se te escapa nada.</p>
        )}
        {levels.length && phase.level ? (
          <LevelChoice
            levels={levels}
            suggested={phase.suggested ?? phase.level}
            value={phase.level}
            onChange={(level) => setPhase({ ...phase, level })}
          />
        ) : null}
        <p className="text-base text-ink-muted">Puedes repetir la prueba cuando quieras desde tu perfil.</p>
        <div className="mt-auto pt-4">
          <Button fullWidth onClick={finish}>
            Ir a mi ruta
          </Button>
        </div>
      </div>
    );
  }

  const q = questions[phase.index];
  return (
    <div className="flex flex-1 flex-col gap-5">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Salir de la prueba"
          title="Salir de la prueba"
          onClick={() => {
            stop();
            if (retake) router.push("/perfil/");
            else setPhase({ name: "welcome" });
          }}
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-full text-ink-muted hover:bg-sand focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
        >
          <CloseIcon className="size-7" />
        </button>
        <ProgressBar value={phase.index} max={questions.length} label="Progreso de la prueba" />
      </div>
      <p className="text-sm font-bold uppercase tracking-wider text-terracotta-deep">
        Pregunta {phase.index + 1} de {questions.length}
      </p>
      <h1 lang={gloss.tag} className="text-2xl font-extrabold tracking-tight text-ink">
        {glossOf(q.prompt, gloss.lang)}
      </h1>
      {q.text ? (
        <Card className="flex flex-col gap-3">
          <p lang={pack.meta.lang} className="text-xl font-bold text-ink">
            <TargetText text={q.text} lang={pack.meta.lang} />
          </p>
          {q.audio ? <PlayControls audio={q.audio} size="md" /> : null}
        </Card>
      ) : null}
      <ul className="flex flex-col gap-3">
        {q.options.map((option, i) => (
          <li key={`${q.id}-${i}`}>
            <button
              type="button"
              onClick={() => answer(i === q.answer)}
              className={cn(
                "pressable w-full rounded-button border-2 border-line bg-surface px-4 py-3 text-left text-lg font-bold text-ink [--ledge:var(--line)]",
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
              )}
            >
              {typeof option === "string" ? (
                <TargetText text={option} lang={pack.meta.lang} />
              ) : (
                <span lang={gloss.tag}>{glossOf(option, gloss.lang)}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-auto pt-2">
        <Button fullWidth variant="secondary" onClick={() => answer(false)}>
          No lo sé
        </Button>
      </div>
    </div>
  );
}

/** Placement result for a pack with levels: the suggested level, and chips to choose another. */
function LevelChoice({ levels, suggested, value, onChange }: { levels: Level[]; suggested: Level; value: Level; onChange: (level: Level) => void }) {
  return (
    <Card tone="lemon" className="flex flex-col gap-3">
      <p className="text-lg font-bold text-ink">Te recomendamos el nivel {suggested}</p>
      <p className="text-base text-ink">
        Tu ruta mostrará las unidades de este nivel. Si prefieres otro, elígelo aquí; puedes cambiarlo cuando quieras.
      </p>
      <LevelChips levels={levels} value={value} onChange={onChange} label="Elige tu nivel" />
    </Card>
  );
}
