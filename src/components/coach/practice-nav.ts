/**
 * The role-play page of a saved pack: `/preparar/dialogo/?pack=<id>` (static page, the pack comes
 * from the device, so it works offline). Opened from the pack view; "back" returns to it.
 */
import { PACK_PARAM, packHref, PREPARE_HREF } from "./nav";

export const PRACTICE_HREF = `${PREPARE_HREF}dialogo/`;
export const PRACTICE_TITLE = "Practica el diálogo";

export function practiceHref(id: string): string {
  return `${PRACTICE_HREF}?${PACK_PARAM}=${encodeURIComponent(id)}`;
}

/** True while the history entry before the role-play is its pack view (in-memory: a reload resets it). */
let openedFromPack = false;

/** Call from the tap that opens the role-play from the pack view. */
export function notePracticeOpened(): void {
  openedFromPack = true;
}

/** Back to the pack view: the previous history entry when it is that view, else `replace` with it. */
export function leavePractice(id: string, replace: (href: string) => void): void {
  if (openedFromPack) {
    openedFromPack = false;
    window.history.back();
    return;
  }
  replace(packHref(id));
}
