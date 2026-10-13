/**
 * "Mis rutas" (Modo rápido): the quick routes saved on the device per language pack, newest
 * first, unique ids, no count cap. Key `lang-lern:coach:routes:<lang>` = `{ v: 1, routes }`.
 * Invalid stored routes are dropped whole; nothing throws. Saving a route downloads its audio in
 * the background (offline listening); deleting one deletes the cached mp3s no saved pack or route
 * uses any more. Routes are deleted only by the learner.
 */
import { cacheRouteAudio } from "./audio";
import { parseSavedRoutes, SAVED_LIST_VERSION } from "./parse";
import { pruneAfter, startPrefetch, stopPrefetch } from "./saved-audio";
import { COACH_KEYS, readRaw, writeJson } from "./store";
import type { CoachRoute } from "./types";

export const readRoutesRaw = (lang: string): string => readRaw(COACH_KEYS.routes(lang));

export function getSavedRoutes(lang: string): CoachRoute[] {
  if (typeof window === "undefined") return [];
  return parseSavedRoutes(readRoutesRaw(lang));
}

export function getSavedRoute(lang: string, id: string): CoachRoute | undefined {
  return getSavedRoutes(lang).find((r) => r.id === id);
}

function write(lang: string, routes: CoachRoute[]): boolean {
  return writeJson(COACH_KEYS.routes(lang), { v: SAVED_LIST_VERSION, routes });
}

/**
 * Saves a route at the top of the list (a route with the same id is replaced) and downloads its
 * audio in the background. False if storage failed (nothing downloaded).
 */
export function saveRoute(route: CoachRoute): boolean {
  const routes = getSavedRoutes(route.lang);
  const replaced = routes.some((r) => r.id === route.id);
  if (!write(route.lang, [route, ...routes.filter((r) => r.id !== route.id)])) return false;
  const oldStopped = startPrefetch("route", route.lang, route.id, (signal) => cacheRouteAudio(route, signal));
  if (replaced) pruneAfter(oldStopped);
  return true;
}

/** Deletes a saved route, stops its audio download and deletes the mp3s nothing saved uses any more. */
export function deleteRoute(lang: string, id: string): void {
  write(lang, getSavedRoutes(lang).filter((r) => r.id !== id));
  pruneAfter(stopPrefetch("route", lang, id));
}
