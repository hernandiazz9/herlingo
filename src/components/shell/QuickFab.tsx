"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useSyncExternalStore } from "react";
import { coachAvailable } from "@/lib/coach/available";
import { useActiveLang } from "@/lib/content/use-active-lang";
import { getTab, normalizePath } from "@/lib/navigation";

const QUICK = getTab("quick");

/**
 * Routes without the button: Modo rápido itself, and flows with their own fixed bottom controls or a
 * running exercise. A prefix hides every page under it.
 */
const HIDDEN_PREFIXES: readonly string[] = [
  QUICK.href, // /rapido/ (and ?ruta=)
  getTab("sport").href, // /deporte/ (and ?ep=): the episode player
  "/leccion/", // a lesson
  "/preparar/nivel/", // the level interview
  "/preparar/dialogo/", // pack practice (role-play)
  getTab("microphone").href, // /microfono/, the mic test
  "/bienvenida/", // onboarding and the placement test (/bienvenida/prueba/)
].map(normalizePath);

/** Lists that keep the button while one of their items (a dialogue, a story) hides it. */
const HIDDEN_ITEMS_OF: readonly string[] = ["/dialogos/", "/historias/"].map(normalizePath);

function hiddenOn(pathname: string): boolean {
  const path = normalizePath(pathname);
  return (
    HIDDEN_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`)) ||
    HIDDEN_ITEMS_OF.some((p) => path.startsWith(`${p}/`))
  );
}

// In-place flows (a game round, a review session) hide the button while they run: a counter, so
// two flows mounted at once cannot show it again early.
let hiders = 0;
const listeners = new Set<() => void>();

function setHiders(next: number) {
  hiders = next;
  listeners.forEach((fn) => fn());
}

function subscribeHiders(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const isHidden = () => hiders > 0;
const notHidden = () => false;

/**
 * Hides the ⚡ button while `hide` is true (one call per in-place flow). Layout effect: the button
 * goes in the same frame the exercise appears.
 */
export function useHideQuickFab(hide = true): void {
  useLayoutEffect(() => {
    if (!hide) return;
    setHiders(hiders + 1);
    return () => setHiders(hiders - 1);
  }, [hide]);
}

/**
 * Floating ⚡ button to Modo rápido (docs/coach.md "Modo rápido" → "Access"), mounted once in the root
 * layout: bottom right of the column, just above the tab bar.
 *
 * Hidden:
 * - before the active language is ready, on first launch (no active language) and when the active
 *   pack is not `coachAvailable`;
 * - on `/rapido/` itself and on `/deporte/` (Modo deporte);
 * - in flows with fixed bottom controls or a running exercise: a lesson (`/leccion/…`), a dialogue
 *   (`/dialogos/<id>/`), a story (`/historias/<id>/`), the level interview (`/preparar/nivel/`), pack
 *   practice (`/preparar/dialogo/`), the mic test (`/microfono/`), onboarding and the placement test
 *   (`/bienvenida/…`); in place, through `useHideQuickFab`: a game (discovery cards and round, on
 *   `/jugar/`) and a review session (`/repaso/`);
 * - while the update prompt is showing (same spot; globals.css, `[data-update-prompt]`).
 *
 * While shown, `[data-quick-fab]` sets `--quick-fab-space` (globals.css), the extra bottom padding of
 * `<main>`, so the end of every page scrolls clear of it. Full-screen overlays (z-60) cover it.
 */
export function QuickFab() {
  const pathname = usePathname() ?? "/";
  const { ready, lang } = useActiveLang();
  const hidden = useSyncExternalStore(subscribeHiders, isHidden, notHidden);

  if (!ready || !lang || !coachAvailable(lang) || hidden || hiddenOn(pathname)) return null;

  return (
    <div
      data-quick-fab=""
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar-height)+var(--safe-bottom)+0.75rem)] z-40 mx-auto flex w-full max-w-[var(--column-width)] justify-end pr-[calc(1rem+env(safe-area-inset-right))]"
    >
      <Link
        href={QUICK.href}
        aria-label={QUICK.title}
        className="pressable pointer-events-auto flex size-[var(--quick-fab-size)] items-center justify-center rounded-full border-4 border-surface bg-sea [--ledge:var(--sea-ledge)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
      >
        <span aria-hidden="true" className="text-2xl leading-none">
          ⚡
        </span>
      </Link>
    </div>
  );
}
