/**
 * Modo rápido URLs. Everything lives on the one static page `/rapido/`; an open route is
 * `/rapido/?ruta=<id>`, reached by shallow navigation (`history.pushState`, which the Next router
 * syncs with `useSearchParams`): no request, so saved routes open offline. Same scheme as
 * Prepárate's `?pack=` (components/coach/nav.ts).
 */
import { getTab } from "@/lib/navigation";

const section = getTab("quick");

export const QUICK_HREF = section.href;
export const QUICK_TITLE = section.title;
export const QUICK_SUBTITLE = "Escribe qué necesitas y te preparo lo que te van a decir y qué responder.";
export const ROUTE_PARAM = "ruta";

export function routeHref(id: string): string {
  return `${QUICK_HREF}?${ROUTE_PARAM}=${encodeURIComponent(id)}`;
}

/** True while the history entry before the open route is the Modo rápido home (in-memory: a reload resets it). */
let openedFromHome = false;

/** Shows a route (call from a tap). */
export function openRoute(id: string): void {
  window.history.pushState(null, "", routeHref(id));
  openedFromHome = true;
  window.scrollTo(0, 0);
}

/** Back to the Modo rápido home: the previous history entry when it is the home, else replaces this one. */
export function closeRoute(): void {
  if (openedFromHome) {
    openedFromHome = false;
    window.history.back();
    return;
  }
  window.history.replaceState(null, "", QUICK_HREF);
  window.scrollTo(0, 0);
}
