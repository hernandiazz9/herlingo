/**
 * Whether the user closed the "Compite con tus amigos" invite on Ruta (device only).
 * localStorage `lang-lern:league-invite-dismissed` = "1". Tolerant: anything else = not dismissed.
 * Liga's own account/group/board keys are never touched here.
 */
import { useSyncExternalStore } from "react";

const KEY = "lang-lern:league-invite-dismissed";
const EVENT = "lang-lern:league-invite-dismissed-change";

let memory = false;

function read(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function dismissLeagueInvite() {
  memory = true;
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Blocked storage: hidden for this page view only.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

/** True once dismissed (false on the server and during hydration). */
export function useLeagueInviteDismissed(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => memory || read(),
    () => false,
  );
}
