/**
 * Device storage for Prepárate: versioned JSON under `lang-lern:coach:*` in localStorage, one
 * change event for every key (hooks snapshot the raw string, so unrelated keys never re-render).
 *
 *   lang-lern:coach:access           { v, code }                   access code (all packs)
 *   lang-lern:coach:usage            { v, at, usage }              last usage summary seen
 *   lang-lern:coach:packs:<lang>     { v, packs: CoachPack[] }     "Mis situaciones", newest first
 *   lang-lern:coach:routes:<lang>    { v, routes: CoachRoute[] }   "Mis rutas" (Modo rápido), newest first
 *   lang-lern:coach:episodes:<lang>  { v, episodes: StoredEpisode[] }  "Mis episodios" (Modo deporte), newest first
 *   lang-lern:coach:profile:<lang>   { v, about, assessments }     "Sobre mí" + interview results
 *   lang-lern:coach:practice:<lang>  { v, day, packs: id[] }       packs whose role-play earned XP that day
 */
export const COACH_PREFIX = "lang-lern:coach:";
const EVENT = "lang-lern:coach-change";

export const COACH_KEYS = {
  access: `${COACH_PREFIX}access`,
  usage: `${COACH_PREFIX}usage`,
  packs: (lang: string) => `${COACH_PREFIX}packs:${lang}`,
  routes: (lang: string) => `${COACH_PREFIX}routes:${lang}`,
  episodes: (lang: string) => `${COACH_PREFIX}episodes:${lang}`,
  profile: (lang: string) => `${COACH_PREFIX}profile:${lang}`,
  practice: (lang: string) => `${COACH_PREFIX}practice:${lang}`,
};

/** Raw stored value ("" when none or unreadable): a stable snapshot for useSyncExternalStore. */
export function readRaw(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

/** The stored object when its `v` is `version`; undefined when absent, corrupt or another version. */
export function readVersioned(raw: string, version: number): Record<string, unknown> | undefined {
  if (!raw) return undefined;
  try {
    const v: unknown = JSON.parse(raw);
    if (v && typeof v === "object" && !Array.isArray(v) && (v as { v?: unknown }).v === version) {
      return v as Record<string, unknown>;
    }
  } catch {
    // Corrupt value: treated as absent.
  }
  return undefined;
}

/** Writes `value` as JSON and notifies subscribers. False when storage is unavailable or full. */
export function writeJson(key: string, value: unknown): boolean {
  let ok = true;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    ok = false;
  }
  window.dispatchEvent(new Event(EVENT));
  return ok;
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing stored.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Subscribes to changes of any coach key, in this tab and in other tabs. */
export function subscribeCoach(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(COACH_PREFIX)) onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}
