/**
 * Modo deporte URLs. Everything lives on the one static page `/deporte/`; an open episode is
 * `/deporte/?ep=<id>` (`dlg:<dialogueId>`, `route:<routeId>`, an AI episode's id) and a section's
 * «Escuchar seguidos» `/deporte/?seguidos=<section>` (`JOIN_SECTIONS`), reached by shallow
 * navigation (`history.pushState`, which the Next router syncs with `useSearchParams`): no
 * request, so episodes open offline. Same scheme as Modo rápido's `?ruta=` (components/quick/nav.ts).
 */
import { getTab } from "@/lib/navigation";

const section = getTab("sport");

export const SPORT_HREF = section.href;
export const SPORT_TITLE = section.title;
export const SPORT_SUBTITLE = "Escucha una situación de principio a fin, con el móvil en el bolsillo.";
export const EPISODE_PARAM = "ep";
export const JOIN_PARAM = "seguidos";

/** The sections of the home that «Escuchar seguidos» plays (URL value → section title). */
export const JOIN_SECTIONS = {
  mis: "Mis episodios",
  rutas: "De tus rutas",
  app: "De la app",
} as const;
export type JoinSection = keyof typeof JOIN_SECTIONS;

export function isJoinSection(value: string | null): value is JoinSection {
  return value !== null && Object.hasOwn(JOIN_SECTIONS, value);
}

export function episodeHref(id: string): string {
  return `${SPORT_HREF}?${EPISODE_PARAM}=${encodeURIComponent(id)}`;
}

export function joinedHref(section: JoinSection): string {
  return `${SPORT_HREF}?${JOIN_PARAM}=${section}`;
}

/** True while the history entry before the open episode is the Modo deporte home (in-memory: a reload resets it). */
let openedFromHome = false;

function show(href: string): void {
  window.history.pushState(null, "", href);
  openedFromHome = true;
  window.scrollTo(0, 0);
}

/** Shows an episode (call from a tap). */
export function openEpisode(id: string): void {
  show(episodeHref(id));
}

/** Shows a section's episodes joined into one audio, «Escuchar seguidos» (call from a tap). */
export function openJoined(section: JoinSection): void {
  show(joinedHref(section));
}

/** Back to the Modo deporte home: the previous history entry when it is the home, else replaces this one. */
export function closeEpisode(): void {
  if (openedFromHome) {
    openedFromHome = false;
    window.history.back();
    return;
  }
  window.history.replaceState(null, "", SPORT_HREF);
  window.scrollTo(0, 0);
}
