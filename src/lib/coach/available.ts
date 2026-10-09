import { getPack, glossIsTargetLanguage, glossLangsOf, hasPack } from "@/lib/content";

/**
 * Whether Prepárate is offered for pack `lang`: its prompts write Spain Spanish glosses for a learner
 * of another language, so only for a pack whose `glossLangs` include `es` (every pack without
 * `glossLangs`) and whose target language is not Spanish itself (a regional Spanish pack explained in
 * Spain Spanish, `glossIsTargetLanguage`). The API refuses the others too (`api/_lib/languages.ts`).
 * Entry points (Jugar card, Perfil level interview, the /preparar/ pages) check this.
 */
export function coachAvailable(lang: string): boolean {
  if (!hasPack(lang)) return false;
  const meta = getPack(lang).meta;
  return glossLangsOf(meta).includes("es") && !glossIsTargetLanguage(meta, "es");
}
