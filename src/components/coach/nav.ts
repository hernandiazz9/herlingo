/**
 * Prepárate URLs. Everything lives on the one static page `/preparar/`; an open pack is
 * `/preparar/?pack=<id>`, reached by shallow navigation (`history.pushState`, which the Next
 * router syncs with `useSearchParams`): no request, so saved packs open offline.
 */
import { getTab } from "@/lib/navigation";

const section = getTab("prepare");

export const PREPARE_HREF = section.href;
export const PREPARE_TITLE = section.title;
export const PREPARE_SUBTITLE = "Cuéntame qué vas a hacer y te preparo los pasos, las frases clave y un diálogo para practicar.";
export const PACK_PARAM = "pack";

export function packHref(id: string): string {
  return `${PREPARE_HREF}?${PACK_PARAM}=${encodeURIComponent(id)}`;
}

/** True while the history entry before the open pack is the Prepárate home (in-memory: a reload resets it). */
let openedFromHome = false;

/** Shows a pack (call from a tap). */
export function openPack(id: string): void {
  window.history.pushState(null, "", packHref(id));
  openedFromHome = true;
  window.scrollTo(0, 0);
}

/** Back to the Prepárate home: the previous history entry when it is the home, else replaces this one. */
export function closePack(): void {
  if (openedFromHome) {
    openedFromHome = false;
    window.history.back();
    return;
  }
  window.history.replaceState(null, "", PREPARE_HREF);
  window.scrollTo(0, 0);
}

/**
 * Moves keyboard and screen-reader focus to the page heading (PageHeader's h1, `tabIndex={-1}`)
 * after the view changed in place (pack opened, closed, created or refined). Call after rendering.
 */
export function focusPageHeading(): void {
  document.querySelector<HTMLElement>("main h1")?.focus({ preventScroll: true });
}
