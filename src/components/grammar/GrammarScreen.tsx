"use client";

import type { ReactNode } from "react";
import { LessonLangContext } from "@/components/exercises/shared";
import { LearnCopyProvider } from "@/lib/i18n/use-learn-copy";

/** Route of a Gramática entry (a verb or a topic), with the trailing slash links use. */
export function grammarHref(id: string): string {
  return `/gramatica/${encodeURIComponent(id)}/`;
}

/**
 * Wraps a Gramática screen of pack `lang`: audio, `lang` attributes and glosses of the shared
 * exercise helpers (`MiniPlay`, `GrammarCardBody`) use that pack, and its copy the gloss language.
 */
export function GrammarScreen({ lang, children }: { lang: string; children: ReactNode }) {
  return (
    <LessonLangContext.Provider value={lang}>
      <LearnCopyProvider lang={lang}>{children}</LearnCopyProvider>
    </LessonLangContext.Provider>
  );
}
