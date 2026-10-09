"use client";

import { cn } from "@/lib/cn";
import { GLOSS_LANGUAGES, languageName } from "@/lib/content";
import { useGlossLang } from "@/lib/content/use-gloss";

/**
 * "Traducciones en": the language of translations, notes and grammar cards for this pack. Shown
 * only for a pack that carries two or more gloss languages (`glossLangs`); stored per pack.
 */
export function GlossSection({ lang }: { lang: string }) {
  const gloss = useGlossLang(lang);
  if (gloss.langs.length < 2) return null;
  return (
    <section aria-labelledby="gloss-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="gloss-title" className="text-2xl font-extrabold tracking-tight text-ink">
          Traducciones en
        </h2>
        <p className="text-sm text-ink-muted">
          El idioma de las traducciones, notas y fichas de {languageName(lang)}. Cambiarlo no borra nada.
        </p>
      </div>
      <div role="group" aria-label="Idioma de las traducciones" className="flex flex-wrap gap-2">
        {gloss.langs.map((code) => {
          const active = code === gloss.lang;
          const { name, nativeName } = GLOSS_LANGUAGES[code];
          return (
            <button
              key={code}
              type="button"
              aria-pressed={active}
              onClick={() => gloss.setLang(code)}
              className={cn(
                "min-h-11 shrink-0 rounded-full border-2 px-4 text-base font-bold whitespace-nowrap",
                "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
                active ? "border-sea bg-sea text-on-accent" : "border-line bg-surface text-ink",
              )}
            >
              {name}
              {nativeName !== name ? (
                <span lang={GLOSS_LANGUAGES[code].tag} className="font-normal">
                  {" "}
                  · {nativeName}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
