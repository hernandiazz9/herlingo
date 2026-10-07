"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getPack, hasPack, romanize } from "./index";
import { getShowRomanization, setShowRomanization, subscribeShowRomanization } from "./romanization";

const yes = () => true;

/**
 * The Latin-line choice for `lang` (see `./romanization`), live. `available` = the pack has
 * `romanization` (the Perfil switch shows only then); `show` is the stored choice (default true).
 */
export function useShowRomanization(lang: string | null): {
  available: boolean;
  show: boolean;
  setShow: (show: boolean) => void;
} {
  const show = useSyncExternalStore(
    subscribeShowRomanization,
    () => (lang ? getShowRomanization(lang) : true),
    yes,
  );
  const setShow = useCallback((next: boolean) => {
    if (lang) setShowRomanization(lang, next);
  }, [lang]);
  const available = !!lang && hasPack(lang) && !!getPack(lang).meta.romanization;
  return { available, show, setShow };
}

/**
 * The Latin line for `text` in `lang`, or null when it should not show: the pack has no
 * `romanization`, the learner switched it off, or the romanization equals the text.
 */
export function useRomanization(text: string, lang: string | null): string | null {
  const { available, show } = useShowRomanization(lang);
  if (!available || !show || !lang) return null;
  const latin = romanize(text, getPack(lang));
  return latin && latin !== text ? latin : null;
}
