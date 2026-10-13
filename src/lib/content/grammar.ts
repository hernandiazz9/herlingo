/**
 * Gramática playables (docs/content-guide.md, "Grammar reference"). Pure over a `Pack` (no bundle
 * import), so `listPlayables()` and the mp3 planner (scripts/audio/plan.ts) share one list.
 *
 *   verb infinitive              <verbId>
 *   verb form n of a tense       <verbId>--<tenseId>--<n>   ("io sono"; the form alone without `speak`)
 *   verb tense example           <verbId>--<tenseId>--e
 *   drill n (card or verb)       <id>--g<n>                 (the full sentence, gap filled)
 */
import type { Pack, Playable } from "./types";

/** Every Gramática playable of the pack: verb infinitives, forms, tense examples, card and verb drills. */
export function grammarPlayables(pack: Pack): Playable[] {
  const out: Playable[] = [];
  // `?? []`: a bundle written before verbs existed has no `verbs`.
  for (const v of pack.verbs ?? []) {
    out.push(v);
    for (const t of v.tenses) out.push(...t.forms, t.example);
    out.push(...(v.drills ?? []));
  }
  for (const g of pack.grammar) out.push(...(g.drills ?? []));
  return out;
}
