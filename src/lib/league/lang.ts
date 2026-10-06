import { getPack } from "@/lib/content";
import { getActiveLang } from "@/lib/content/active";

/**
 * The pack the XP sync always includes (`sync.ts`): the active language, else the default pack
 * (first launch). The Liga itself is the same for every language.
 */
export function leagueLang(): string {
  return getActiveLang() ?? getPack().meta.lang;
}
