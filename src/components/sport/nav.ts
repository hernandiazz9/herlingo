/**
 * Modo deporte URLs. Everything lives on the one static page `/deporte/`; an open episode is
 * `/deporte/?ep=<id>` (`dlg:<dialogueId>`, `route:<routeId>`, an AI episode's id), reached by
 * shallow navigation (`history.pushState`, which the Next router syncs with `useSearchParams`):
 * no request, so episodes open offline. Same scheme as Modo rápido's `?ruta=`
 * (components/quick/nav.ts).
 */
import { getTab } from "@/lib/navigation";

const section = getTab("sport");

export const SPORT_HREF = section.href;
export const SPORT_TITLE = section.title;
export const SPORT_SUBTITLE = "Escucha una situación de principio a fin, con el móvil en el bolsillo.";
export const EPISODE_PARAM = "ep";

export function episodeHref(id: string): string {
  return `${SPORT_HREF}?${EPISODE_PARAM}=${encodeURIComponent(id)}`;
}

/** True while the history entry before the open episode is the Modo deporte home (in-memory: a reload resets it). */
let openedFromHome = false;

/** Shows an episode (call from a tap). */
export function openEpisode(id: string): void {
  window.history.pushState(null, "", episodeHref(id));
  openedFromHome = true;
  window.scrollTo(0, 0);
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
