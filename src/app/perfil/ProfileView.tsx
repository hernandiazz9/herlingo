"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Button, Card } from "@/components/ui";
import { leagueEnabled, LEAGUE_PATH } from "@/lib/league/config";
import { useLeagueAccount } from "@/lib/league/use-league-account";
import { getAllLessons, getPack, languageName, listPacks } from "@/lib/content";
import { useScreenLang } from "@/lib/content/use-active-lang";
import { useLevel } from "@/lib/content/level-hook";
import { useShowRomanization } from "@/lib/content/use-romanization";
import { LevelChips } from "@/components/level/LevelChips";
import { cn } from "@/lib/cn";
import { getTab } from "@/lib/navigation";
import { resetProgress, updateSettings, wordsLearned } from "@/lib/progress";
import { useAppPoints, useProgress, useSettings, type AppPoints } from "@/lib/progress/use-progress";
import { LanguagePicker, pickablePacks, useChooseLanguage } from "@/components/language/LanguagePicker";
import { BackupSection } from "./BackupSection";
import { CloudSaveSection } from "./CloudSaveSection";
import { CoachSections } from "./CoachSections";
import { GlossSection } from "./GlossSection";
import { coachAvailable } from "@/lib/coach/available";

/** Destructive button: error colours, same shape and press animation as `Button`. */
const DANGER =
  "pressable inline-flex items-center justify-center rounded-button border-2 border-error bg-surface px-5 font-bold tracking-wide text-error-deep [--ledge:var(--error-ledge)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep";

/** Stats (XP, streak, words, lessons), the AI coach sections and settings. */
export function ProfileView() {
  const lang = useScreenLang();
  return lang ? <Profile key={lang} lang={lang} /> : null;
}

function Profile({ lang }: { lang: string }) {
  const router = useRouter();
  const pack = getPack(lang);
  const progress = useProgress(lang);
  const settings = useSettings();
  const romanization = useShowRomanization(lang);
  const points = useAppPoints();
  const [confirmReset, setConfirmReset] = useState(false);

  const lessonsTotal = getAllLessons(pack).length;
  const lessonsDone = getAllLessons(pack).filter((l) => l.id in progress.lessons).length;

  const reset = () => {
    resetProgress(lang);
    setConfirmReset(false);
    router.push("/");
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Stat value={points.monthXp} label={points.month ? `XP de ${points.month}` : "XP del mes"} note="Todos los idiomas" />
        <Stat value={points.streak} label={points.streak === 1 ? "día seguido" : "días seguidos"} note={`Récord: ${points.best}`} />
      </div>

      <LifetimeCard points={points} current={lang} />

      <div className="grid grid-cols-2 gap-3">
        <Stat value={wordsLearned(progress, pack)} label="palabras aprendidas" note={`De ${languageName(lang)}`} />
        <Stat value={`${lessonsDone}/${lessonsTotal}`} label="lecciones hechas" note={`De ${languageName(lang)}`} />
      </div>

      {pickablePacks().length > 1 ? <LanguageSection lang={lang} /> : null}

      <GlossSection lang={lang} />

      <LevelSection lang={lang} />

      {leagueEnabled() ? <LeagueLink /> : null}

      {coachAvailable(lang) ? <CoachSections lang={lang} /> : null}

      <section aria-labelledby="settings-title" className="flex flex-col gap-3">
        <h2 id="settings-title" className="text-2xl font-extrabold tracking-tight text-ink">
          Ajustes
        </h2>
        <Card className="flex flex-col gap-4">
          <Toggle
            label="Audio lento por defecto"
            hint="Todo el audio suena más despacio."
            checked={settings.slowAudio}
            onChange={(v) => updateSettings({ slowAudio: v })}
          />
          <div className="h-0.5 bg-line" />
          <Toggle
            label="Ejercicios de hablar"
            hint="Decir frases en voz alta en lecciones y repasos."
            checked={settings.speaking}
            onChange={(v) => updateSettings({ speaking: v })}
          />
          {romanization.available ? (
            <>
              <div className="h-0.5 bg-line" />
              <Toggle
                label="Mostrar transliteración"
                hint={`Las letras latinas debajo del ${languageName(lang)}.`}
                checked={romanization.show}
                onChange={romanization.setShow}
              />
            </>
          ) : null}
        </Card>
        <Card className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-ink">Tema</h3>
            <p className="text-sm text-ink-muted">Sistema sigue el modo claro u oscuro de tu móvil.</p>
          </div>
          <ThemeToggle />
        </Card>
        {pack.placement.length ? (
          <Card className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-bold text-ink">Prueba de nivel</h3>
              <p className="text-sm text-ink-muted">Unos 3 minutos. Marca como hechas las lecciones que ya dominas.</p>
            </div>
            <Link
              href="/bienvenida/prueba/"
              className="pressable inline-flex min-h-12 items-center justify-center rounded-button border-2 border-line bg-surface px-5 text-base font-bold text-sea [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
            >
              Repetir la prueba de nivel
            </Link>
          </Card>
        ) : null}
        <Card className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-ink">Instalar en el iPhone</h3>
            <p className="text-sm text-ink-muted">Añádela a la pantalla de inicio y úsala sin conexión.</p>
          </div>
          <Link
            href="/instalar/"
            className="pressable inline-flex min-h-12 items-center justify-center rounded-button border-2 border-line bg-surface px-5 text-base font-bold text-sea [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
          >
            Cómo instalarla
          </Link>
        </Card>
        <Card className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-ink">Probar micrófono</h3>
            <p className="text-sm text-ink-muted">Comprueba si la app te oye y mira qué pasó en tus últimos intentos.</p>
          </div>
          <Link
            href={getTab("microphone").href}
            className="pressable inline-flex min-h-12 items-center justify-center rounded-button border-2 border-line bg-surface px-5 text-base font-bold text-sea [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
          >
            Probar micrófono
          </Link>
        </Card>
        <Card tone="terracotta" className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-bold text-ink">Borrar progreso</h3>
            <p className="text-sm text-ink">
              Lecciones, XP, días de práctica y repasos de {languageName(lang)} en este móvil. Los demás idiomas no se
              tocan. No se puede deshacer.
            </p>
          </div>
          <button type="button" onClick={() => setConfirmReset(true)} className={cn(DANGER, "min-h-12 text-base")}>
            Borrar mi progreso
          </button>
        </Card>
      </section>

      <CloudSaveSection />

      <BackupSection />

      {confirmReset ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-backdrop/80 p-4 pb-[calc(var(--safe-bottom)+1rem)]">
          <div
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="reset-title"
            aria-describedby="reset-desc"
            className="flex w-full max-w-[calc(var(--column-width)-2rem)] flex-col gap-4 rounded-card border-2 border-line bg-surface p-5 shadow-[0_12px_40px_-12px_var(--shadow)]"
          >
            <h2 id="reset-title" className="text-2xl font-extrabold text-ink">
              ¿Borrar tu progreso?
            </h2>
            <p id="reset-desc" className="text-base text-ink-muted">
              Perderás {progress.xp} XP de {languageName(lang)}, sus días de práctica y las {lessonsDone} lecciones hechas.
              Volverás a la bienvenida.
            </p>
            <Button fullWidth autoFocus onClick={() => setConfirmReset(false)}>
              Cancelar
            </Button>
            <button type="button" onClick={reset} className={cn(DANGER, "min-h-14 w-full text-lg")}>
              Sí, borrar todo
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** "Idioma que estudias": switch at any time; a language never started opens its welcome. */
function LanguageSection({ lang }: { lang: string }) {
  const choose = useChooseLanguage();
  return (
    <section aria-labelledby="language-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="language-title" className="text-2xl font-extrabold tracking-tight text-ink">
          Idioma que estudias
        </h2>
        <p className="text-sm text-ink-muted">Cada idioma guarda su propio progreso: cambiar no borra nada.</p>
      </div>
      <LanguagePicker current={lang} onChoose={choose} label="Idioma que estudias" />
    </section>
  );
}

/** "Tu nivel" (packs with levels only): the level Ruta shows; other levels keep their progress. */
function LevelSection({ lang }: { lang: string }) {
  const { levels, level, setLevel } = useLevel(lang);
  if (!levels.length || !level) return null;
  return (
    <section aria-labelledby="level-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="level-title" className="text-2xl font-extrabold tracking-tight text-ink">
          Tu nivel
        </h2>
        <p className="text-sm text-ink-muted">
          Tu ruta muestra las unidades de este nivel de {languageName(lang)}. Cambiar de nivel no borra nada.
        </p>
      </div>
      <LevelChips levels={levels} value={level} onChange={setLevel} label="Cambiar nivel" />
    </section>
  );
}

/** Perfil row that opens /liga/ (only rendered when Liga is configured). */
function LeagueLink() {
  const account = useLeagueAccount();
  const joined = account.status === "joined";
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-ink">🏆 Liga</h3>
        <p className="text-sm text-ink-muted">
          {joined ? "Mira tu puesto de la semana y tu grupo." : "Compite con tus amigos por el XP de cada semana."}
        </p>
      </div>
      <Link
        href={LEAGUE_PATH}
        className="pressable inline-flex min-h-12 items-center justify-center rounded-button border-2 border-line bg-surface px-5 text-base font-bold text-sea [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
      >
        {joined ? "Abrir la Liga" : "Conocer la Liga"}
      </Link>
    </Card>
  );
}

/** Lifetime XP (never resets) with the XP of each language. */
function LifetimeCard({ points, current }: { points: AppPoints; current: string }) {
  const metas = new Map(listPacks().map((m) => [m.lang, m]));
  const rows = points.byLang.filter((l) => l.xp > 0 || l.lang === current);
  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-3xl font-extrabold text-ink">{points.lifetimeXp}</span>
        <span className="text-sm font-bold text-ink-muted">XP en total</span>
      </div>
      {points.byLang.length > 1 ? (
        <ul className="flex flex-col gap-1.5 border-t-2 border-line pt-3" aria-label="XP por idioma">
          {rows.map(({ lang, xp }) => {
            const meta = metas.get(lang);
            return (
              <li key={lang} className="flex items-center justify-between gap-3 text-base">
                <span className="flex items-center gap-2 font-bold text-ink">
                  {meta?.emoji ? <span aria-hidden="true">{meta.emoji}</span> : null}
                  {meta?.name ?? lang}
                </span>
                <span className="font-bold text-ink-muted">{xp} XP</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </Card>
  );
}

function Stat({ value, label, note }: { value: ReactNode; label: string; note?: string }) {
  return (
    <Card className="flex flex-col gap-0.5 p-4">
      <span className="text-3xl font-extrabold text-ink">{value}</span>
      <span className="text-sm font-bold text-ink-muted">{label}</span>
      {note ? <span className="text-xs text-ink-muted">{note}</span> : null}
    </Card>
  );
}

function Toggle({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-4 text-left focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-lemon-deep"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-lg font-bold text-ink">{label}</span>
        <span className="text-sm text-ink-muted">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-8 w-14 shrink-0 rounded-full border-2 transition-colors motion-reduce:transition-none",
          checked ? "border-sea bg-sea" : "border-line bg-sand",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-6 rounded-full bg-surface shadow-[0_1px_2px_var(--shadow)] transition-[left] motion-reduce:transition-none",
            checked ? "left-[1.625rem]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
