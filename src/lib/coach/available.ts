import { getPack, glossLangsOf, hasPack } from "@/lib/content";

/**
 * Whether Prepárate is offered for pack `lang`: its prompts write Spain Spanish glosses, so only for
 * a pack whose `glossLangs` include `es` (every pack without `glossLangs`). The API refuses the
 * others too (`api/_lib/languages.ts`). Entry points (Jugar card, Perfil level interview, the
 * /preparar/ pages) check this.
 */
export function coachAvailable(lang: string): boolean {
  return hasPack(lang) && glossLangsOf(getPack(lang).meta).includes("es");
}
