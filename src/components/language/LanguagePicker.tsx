"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { CheckIcon } from "@/components/path/icons";
import { getAllLessons, getPack, listPacks, type PackMeta } from "@/lib/content";
import { setActiveLang } from "@/lib/content/active";
import { cn } from "@/lib/cn";
import { getProgress } from "@/lib/progress";
import { useProgress } from "@/lib/progress/use-progress";
import { useAudioProgress, type AudioCacheProgress } from "@/lib/pwa/audio-cache";

/** Welcome + placement of the active language (shown when it was never onboarded). */
export const WELCOME_HREF = "/bienvenida/";

let pickable: PackMeta[] | undefined;

/** Packs the learner can choose: those with at least one unit, default first. */
export function pickablePacks(): PackMeta[] {
  pickable ??= listPacks().filter((m) => getPack(m.lang).units.length > 0);
  return pickable;
}

/**
 * Makes a language the active one. A language never onboarded opens its welcome; otherwise
 * `then()` runs (stay, go to Ruta…). Each language keeps its own progress: nothing else changes.
 */
export function useChooseLanguage(then?: () => void): (lang: string) => void {
  const router = useRouter();
  return useCallback(
    (lang: string) => {
      setActiveLang(lang);
      if (!getProgress(lang).onboarded) router.push(WELCOME_HREF);
      else then?.();
    },
    [router, then],
  );
}

/** "Audio sin conexión: descargando 40 %" for the active language; null when there is nothing to say. */
export function audioStatusText(p: AudioCacheProgress): string | null {
  const pct = p.total ? Math.floor((p.cached / p.total) * 100) : 0;
  switch (p.state) {
    case "downloading":
      return `Audio sin conexión: descargando ${pct} %`;
    case "error":
      return `Audio sin conexión: en pausa (${pct} %), vuelve a abrir la app con internet`;
    case "ready":
      return p.total ? "Audio sin conexión: listo" : "Audio con la voz de tu móvil";
    default:
      return null;
  }
}

export interface LanguagePickerProps {
  /** The active language (marked as chosen), or null on first launch. */
  current: string | null;
  onChoose: (lang: string) => void;
  /** Accessible name of the list. */
  label?: string;
}

/** Every language you can study, with your progress in each and the offline audio state of the active one. */
export function LanguagePicker({ current, onChoose, label = "Idiomas" }: LanguagePickerProps) {
  return (
    <ul aria-label={label} className="flex flex-col gap-3">
      {pickablePacks().map((meta) => (
        <li key={meta.lang}>
          <LanguageOption meta={meta} chosen={meta.lang === current} onChoose={onChoose} />
        </li>
      ))}
    </ul>
  );
}

function LanguageOption({ meta, chosen, onChoose }: { meta: PackMeta; chosen: boolean; onChoose: (lang: string) => void }) {
  const progress = useProgress(meta.lang);
  const pack = getPack(meta.lang);
  const lessons = getAllLessons(pack);
  const done = lessons.filter((l) => l.id in progress.lessons).length;
  const detail = progress.onboarded || progress.xp > 0 ? `${done} de ${lessons.length} lecciones · ${progress.xp} XP` : "Sin empezar";

  return (
    <button
      type="button"
      aria-pressed={chosen}
      onClick={() => onChoose(meta.lang)}
      className={cn(
        "pressable flex w-full items-center gap-4 rounded-button border-2 px-4 py-3 text-left",
        "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
        chosen ? "border-sea bg-sea-soft [--ledge:var(--sea-ledge)]" : "border-line bg-surface [--ledge:var(--line)]",
      )}
    >
      <span aria-hidden="true" className="text-4xl leading-none">
        {meta.emoji ?? "🌍"}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-lg font-bold text-ink">
          {meta.name}
          {meta.nativeName && meta.nativeName !== meta.name ? (
            <span lang={meta.lang} className="font-normal text-ink-muted">
              {" "}
              · {meta.nativeName}
            </span>
          ) : null}
        </span>
        <span className="text-sm text-ink-muted">{detail}</span>
        {chosen ? <ActiveAudio /> : null}
      </span>
      {chosen ? (
        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-sea text-on-accent">
          <CheckIcon className="size-5" />
        </span>
      ) : null}
    </button>
  );
}

function ActiveAudio() {
  const text = audioStatusText(useAudioProgress());
  return text ? <span className="text-sm font-bold text-sea-deep">{text}</span> : null;
}
