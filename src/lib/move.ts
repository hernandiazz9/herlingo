/**
 * "Herlingo se muda" (2026-10-15): the app moved from `LEGACY_HOSTS` to `APP_URL`. Every address
 * has its own on-device data, so the old one keeps working and shows how to move (Perfil
 * "Herlingo se muda", plus a card on the route that can be put off for a week); the new one
 * offers to bring a backup file on first launch. Browser only: false on the server.
 */
import { APP_URL, LEGACY_HOSTS } from "@/lib/app-config";

const SNOOZE_KEY = "lang-lern:move-notice";
const SNOOZE_DAYS = 7;

/** "herlingo.vercel.app", for copy. */
export const APP_HOST = new URL(APP_URL).host;

/** True on an old address of the app. */
export function onLegacyHost(): boolean {
  return typeof window !== "undefined" && LEGACY_HOSTS.includes(window.location.hostname);
}

/** True when the route's card was put off less than `SNOOZE_DAYS` ago. */
export function moveNoticeSnoozed(now: number = Date.now()): boolean {
  try {
    const at = Number(localStorage.getItem(SNOOZE_KEY));
    return Number.isFinite(at) && at > 0 && now - at < SNOOZE_DAYS * 86_400_000;
  } catch {
    return false;
  }
}

/** "Ahora no": hides the route's card for `SNOOZE_DAYS` (Perfil keeps the steps). */
export function snoozeMoveNotice(now: number = Date.now()): void {
  try {
    localStorage.setItem(SNOOZE_KEY, String(now));
  } catch {
    // Storage refused: the card comes back next time.
  }
}

const noChanges = () => () => {};

/** For `useSyncExternalStore`: the address never changes while the page is open. */
export const subscribeHost = noChanges;
