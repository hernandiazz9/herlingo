"use client";

import { useCallback, useSyncExternalStore } from "react";
import { glossTag, type GlossLang } from "./gloss";
import { getGlossLang, packGlossLangs, setGlossLang, subscribeGlossLang } from "./gloss-choice";

export interface GlossChoice {
  /** The gloss language to show: pass it to `glossOf()`. */
  lang: GlossLang;
  /** `lang` attribute for elements that show a gloss (undefined for Spain Spanish, the page's language). */
  tag: string | undefined;
  /** The pack's gloss languages (the Perfil picker shows only when there are two or more). */
  langs: readonly GlossLang[];
  setLang: (gloss: GlossLang) => void;
}

/** The learner's gloss language for pack `lang` (see `./gloss-choice`), live. */
export function useGlossLang(lang: string | null): GlossChoice {
  const gloss = useSyncExternalStore(
    subscribeGlossLang,
    () => (lang ? getGlossLang(lang) : "es"),
    () => (lang ? packGlossLangs(lang)[0] : "es"),
  );
  const setLang = useCallback((next: GlossLang) => {
    if (lang) setGlossLang(lang, next);
  }, [lang]);
  return { lang: gloss, tag: glossTag(gloss), langs: lang ? packGlossLangs(lang) : ["es"], setLang };
}
