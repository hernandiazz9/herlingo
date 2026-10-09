"use client";

import { glossOf, type GlossBase, type GlossText } from "@/lib/content";
import { useGlossLang } from "@/lib/content/use-gloss";

/**
 * A gloss in the learner's gloss language for pack `lang`, inline. For server components (page
 * headers) and lists; client code with many glosses reads `useGlossLang()` + `glossOf()` itself.
 *
 * `of` = a gloss field (`notes`, `title`…) or, with an item, its translation (`es` / `ru` / `en`
 * siblings; `base` for `questionEs` / `titleEs`). Spain Spanish renders bare text (no wrapper);
 * another language a `<span lang>`.
 */
export function Gloss({ of, lang, base }: { of: GlossText | object | undefined; lang: string; base?: GlossBase }) {
  const gloss = useGlossLang(lang);
  if (of === undefined) return null;
  const text = typeof of === "string" ? of : glossOf(of, gloss.lang, base);
  return gloss.tag ? <span lang={gloss.tag}>{text}</span> : <>{text}</>;
}
