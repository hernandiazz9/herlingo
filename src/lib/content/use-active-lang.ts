"use client";

import { useSyncExternalStore } from "react";
import { getActiveLang, setActiveLang, subscribeActiveLang } from "./active";
import { DEFAULT_LANG, getPack } from "./index";
import type { Pack } from "./types";

export interface ActiveLang {
  /**
   * False on the server and during hydration: the device's choice is not known yet. UI that
   * depends on the language waits for it (no flash of the wrong language).
   */
  ready: boolean;
  /** Active language, or null (not ready, or first launch: show the picker). */
  lang: string | null;
  /** The active language's pack, or null when `lang` is null. */
  pack: Pack | null;
  setLang: (lang: string) => void;
}

const noop = () => () => {};
const yes = () => true;
const no = () => false;
const none = () => null;

/** The active language, live (see `./active`). */
export function useActiveLang(): ActiveLang {
  const ready = useSyncExternalStore(noop, yes, no);
  const lang = useSyncExternalStore(subscribeActiveLang, getActiveLang, none);
  return { ready, lang, pack: lang ? getPack(lang) : null, setLang: setActiveLang };
}

/**
 * The language a screen shows: the active one, or the default pack when none is chosen yet (first
 * launch). Null until `ready`: render nothing (or a placeholder) until then, so the server render
 * and hydration never show the wrong language.
 */
export function useScreenLang(): string | null {
  const { ready, lang } = useActiveLang();
  return ready ? (lang ?? DEFAULT_LANG) : null;
}
