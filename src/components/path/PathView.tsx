"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Card, ProgressBar } from "@/components/ui";
import { getPack, getUnit } from "@/lib/content";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { cn } from "@/lib/cn";
import { DialoguesIcon, ReviewIcon } from "@/components/icons";
import { RutaLeagueCard } from "@/components/league/RutaCard";
import { WELCOME_HREF } from "@/components/language/LanguagePicker";
import { LanguageSwitch } from "@/components/language/LanguageSwitch";
import { getTab } from "@/lib/navigation";
import { canPersist, dueItemIds, getProgress } from "@/lib/progress";
import { buildPath, lessonHref, type PathLesson, type PathUnit } from "@/lib/progress/path";
import { useAppPoints, useNow, useProgress } from "@/lib/progress/use-progress";
import { BoltIcon, CheckIcon, FlameIcon, LockIcon, PlayIcon } from "./icons";
import { ExpressionView, GrammarCardView, SideSheet } from "./SideSheet";

export { WELCOME_HREF };

const review = getTab("review");
const dialogues = getTab("dialogues");

/** Home: stats, the next lesson, units with their lesson nodes, and side content. */
export function PathView() {
  const lang = useScreenLang();
  return lang ? <Path key={lang} lang={lang} /> : null;
}

function Path({ lang }: { lang: string }) {
  const router = useRouter();
  const pack = getPack(lang);
  const progress = useProgress(lang);
  const now = useNow();
  const path = useMemo(() => buildPath(pack, progress), [pack, progress]);
  const [sheet, setSheet] = useState<"grammar" | "expressions" | null>(null);

  // First launch: welcome + placement test (only when progress can be saved, or it would loop).
  useEffect(() => {
    if (canPersist() && !getProgress(lang).onboarded) router.replace(WELCOME_HREF);
  }, [lang, router]);

  const points = useAppPoints();
  const due = now ? dueItemIds(progress, pack, now).length : 0;
  const current = path.current;
  const currentUnit = current ? getUnit(current.unitId, pack) : undefined;
  const main = path.units.filter((u) => !u.side);
  const side = path.units.filter((u) => u.side);
  const varieties = [...new Set(pack.expressions.map((e) => e.variety.toLowerCase()))];

  return (
    <>
      <LanguageSwitch lang={lang} />

      <div className="grid grid-cols-2 gap-2">
        <Stat icon={<FlameIcon className="size-5 text-terracotta-deep" />} value={points.streak} label={points.streak === 1 ? "día seguido" : "días seguidos"} />
        <Stat icon={<BoltIcon className="size-5 text-lemon-deep" />} value={points.monthXp} label={points.month ? `XP de ${points.month}` : "XP"} />
      </div>

      <Card tone="lemon" className="flex flex-col gap-3">
        {current ? (
          <>
            <p className="text-sm font-bold uppercase tracking-wider text-terracotta-deep">
              {path.done ? "Sigue por aquí" : "Empieza por aquí"}
            </p>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-bold text-ink-muted">
                {currentUnit?.emoji ? `${currentUnit.emoji} ` : ""}
                {currentUnit?.title}
              </p>
              <p className="text-xl font-extrabold text-ink">{current.title}</p>
            </div>
            <Link
              href={lessonHref(current.id)}
              className="pressable inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-button bg-sea px-6 text-lg font-bold tracking-wide text-on-accent [--ledge:var(--sea-ledge)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
            >
              <PlayIcon className="size-5" />
              {path.done ? "Continuar" : "Empezar"}
            </Link>
          </>
        ) : (
          <p className="text-xl font-extrabold text-ink">¡Has terminado la ruta! Repasa y practica con los diálogos.</p>
        )}
        <div className="flex flex-col gap-1">
          <ProgressBar value={path.allDone} max={path.allTotal} label="Progreso de la ruta" />
          <p className="text-sm font-bold text-ink-muted">
            {path.allDone} de {path.allTotal} lecciones
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <SectionCard
          href="/repaso/"
          icon={<ReviewIcon className="size-7" />}
          title={review.title}
          detail={due ? `${due} para repasar` : "¡Todo al día!"}
          highlight={due > 0}
        />
        <SectionCard
          href="/dialogos/"
          icon={<DialoguesIcon className="size-7" />}
          title={dialogues.title}
          detail={`${pack.dialogues.length} ${pack.dialogues.length === 1 ? "conversación" : "conversaciones"}`}
        />
      </div>

      <RutaLeagueCard lang={lang} />

      {main.map((u) => (
        <UnitSection key={u.unit.id} entry={u} />
      ))}

      {side.length || pack.grammar.length || pack.expressions.length ? (
        <section aria-labelledby="side-title" className="flex flex-col gap-4 pt-2">
          <div className="flex flex-col gap-1">
            <h2 id="side-title" className="text-2xl font-extrabold tracking-tight text-ink">
              Para saber más
            </h2>
            <p className="text-base text-ink-muted">Cuando quieras, sin orden: no bloquean la ruta.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {pack.grammar.length ? (
              <SideButton emoji="📘" title="Fichas de gramática" count={pack.grammar.length} onClick={() => setSheet("grammar")} />
            ) : null}
            {pack.expressions.length ? (
              <SideButton
                emoji="👂"
                title={`Expresiones en ${varieties.join(" y ")}`}
                count={pack.expressions.length}
                onClick={() => setSheet("expressions")}
              />
            ) : null}
          </div>
          {side.map((u) => (
            <UnitSection key={u.unit.id} entry={u} />
          ))}
        </section>
      ) : null}

      {sheet === "grammar" ? (
        <SideSheet title="Fichas de gramática" onClose={() => setSheet(null)}>
          {pack.grammar.map((card) => (
            <GrammarCardView key={card.id} card={card} />
          ))}
        </SideSheet>
      ) : null}
      {sheet === "expressions" ? (
        <SideSheet title={`Expresiones en ${varieties.join(" y ")}`} onClose={() => setSheet(null)}>
          <p className="text-base text-ink-muted">Para reconocerlas cuando las oigas, no hace falta que las digas.</p>
          {pack.expressions.map((e) => (
            <ExpressionView key={e.id} item={e} />
          ))}
        </SideSheet>
      ) : null}
    </>
  );
}

function Stat({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-card border-2 border-line bg-surface px-2 py-3 text-center">
      <span className="flex items-center gap-1 text-2xl font-extrabold text-ink">
        {icon}
        {value}
      </span>
      <span className="text-xs font-bold text-ink-muted">{label}</span>
    </div>
  );
}

/** Link card to a section that has no tab of its own (Repaso, Diálogos). */
function SectionCard({ href, icon, title, detail, highlight = false }: { href: string; icon: ReactNode; title: string; detail: string; highlight?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "pressable flex flex-col items-start gap-1 rounded-card border-2 p-4 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
        highlight ? "border-sea bg-sea-soft [--ledge:var(--sea-ledge)]" : "border-line bg-surface [--ledge:var(--line)]",
      )}
    >
      <span className={highlight ? "text-sea-deep" : "text-ink-muted"}>{icon}</span>
      <span className="text-lg font-extrabold text-ink">{title}</span>
      <span className={cn("text-sm font-bold", highlight ? "text-sea-deep" : "text-ink-muted")}>{detail}</span>
    </Link>
  );
}

function SideButton({ emoji, title, count, onClick }: { emoji: string; title: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable flex flex-col items-start gap-1 rounded-card border-2 border-line bg-surface p-4 text-left [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
    >
      <span aria-hidden="true" className="text-2xl">
        {emoji}
      </span>
      <span className="text-base font-bold text-ink">{title}</span>
      <span className="text-sm text-ink-muted">{count}</span>
    </button>
  );
}

/** Horizontal offsets of the lesson nodes: a gentle zigzag. */
const OFFSETS = ["0rem", "1.5rem", "2.5rem", "1.5rem"];

function UnitSection({ entry }: { entry: PathUnit }) {
  const { unit, lessons, done } = entry;
  const complete = done === lessons.length;
  return (
    <section aria-labelledby={`unit-${unit.id}`} className="flex flex-col gap-3">
      <Card tone={complete ? "sea" : "default"} className="flex flex-col gap-2 p-4">
        <div className="flex items-start gap-3">
          {unit.emoji ? (
            <span aria-hidden="true" className="text-3xl leading-none">
              {unit.emoji}
            </span>
          ) : null}
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <h2 id={`unit-${unit.id}`} className="text-xl font-extrabold text-ink">
              {unit.title}
            </h2>
            {unit.description ? <p className="text-sm text-ink-muted">{unit.description}</p> : null}
          </div>
          <span className="shrink-0 text-sm font-bold text-ink-muted">
            {done}/{lessons.length}
          </span>
        </div>
        <ProgressBar value={done} max={lessons.length} label={`Progreso de ${unit.title}`} tone={complete ? "success" : "sea"} className="h-2.5" />
      </Card>
      <ol className="flex flex-col gap-2 px-1">
        {lessons.map((l, i) => (
          <li key={l.lesson.id} style={{ paddingLeft: OFFSETS[i % OFFSETS.length] }}>
            <LessonNode entry={l} n={i + 1} />
          </li>
        ))}
      </ol>
    </section>
  );
}

const NODE: Record<PathLesson["state"], string> = {
  done: "bg-success text-on-accent [--ledge:var(--success-ledge)]",
  current: "bg-lemon text-on-lemon [--ledge:var(--lemon-ledge)] size-16 outline-4 outline-offset-4 outline-lemon",
  available: "bg-sea text-on-accent [--ledge:var(--sea-ledge)]",
  locked: "bg-sand text-ink-muted border-2 border-line",
};

const STATE_LABEL: Record<PathLesson["state"], string> = {
  done: "hecha",
  current: "siguiente",
  available: "disponible",
  locked: "bloqueada",
};

function LessonNode({ entry, n }: { entry: PathLesson; n: number }) {
  const { lesson, state } = entry;
  const circle = (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-14 shrink-0 items-center justify-center rounded-full text-lg font-extrabold",
        state !== "locked" && "pressable",
        NODE[state],
      )}
    >
      {state === "done" ? <CheckIcon className="size-7" /> : state === "locked" ? <LockIcon className="size-6" /> : state === "current" ? <PlayIcon className="size-7" /> : n}
    </span>
  );
  const text = (
    <span className="flex min-w-0 flex-col">
      <span className={cn("text-base font-bold", state === "locked" ? "text-ink-muted" : "text-ink")}>{lesson.title}</span>
      {state === "current" ? <span className="text-sm font-bold text-terracotta-deep">Tu siguiente lección</span> : null}
    </span>
  );
  if (state === "locked") {
    return (
      <div className="flex items-center gap-3 py-1" aria-label={`${lesson.title} (${STATE_LABEL[state]})`}>
        {circle}
        {text}
      </div>
    );
  }
  return (
    <Link
      href={lessonHref(lesson.id)}
      aria-label={`${lesson.title} (${STATE_LABEL[state]})`}
      aria-current={state === "current" ? "step" : undefined}
      className="group flex items-center gap-3 rounded-card py-1 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
    >
      {circle}
      {text}
    </Link>
  );
}
