import { getPack } from "@/lib/content";
import { getActiveLang } from "@/lib/content/active";

/**
 * The pack language sent to the per-language Liga RPCs (`league_me`): the active language, else the
 * default pack (first launch). Read at call time, so a language switch applies to the next refresh.
 */
export function leagueLang(): string {
  return getActiveLang() ?? getPack().meta.lang;
}
