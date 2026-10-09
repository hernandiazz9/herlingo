"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LANG } from "@/lib/content";
import { useGlossLang } from "@/lib/content/use-gloss";
import { learnCopy, type LearnCopy } from "./learn-copy";

/** Copy of the running learning screen; outside one (mic test, Prepárate…) the Spain Spanish copy. */
const LearnCopyContext = createContext<LearnCopy | null>(null);

/** The learning-screen copy for pack `lang` in the learner's gloss language, live. */
export function useLearnCopyFor(lang: string): LearnCopy {
  return learnCopy(lang, useGlossLang(lang).lang);
}

/** Wraps a learning screen (lesson, review, game, dialogue, story) so its components use the gloss language. */
export function LearnCopyProvider({ lang, children }: { lang: string; children: ReactNode }) {
  return <LearnCopyContext.Provider value={useLearnCopyFor(lang)}>{children}</LearnCopyContext.Provider>;
}

/** The copy of the enclosing `LearnCopyProvider`, else Spain Spanish. */
export function useLearnCopy(): LearnCopy {
  return useContext(LearnCopyContext) ?? learnCopy(DEFAULT_LANG, "es");
}
