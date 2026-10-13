/**
 * Gramática drills (docs/grammar.md, "Exercises"): fill-the-gap exercises for a drillable entry
 * (a verb, or a grammar card with `drills`). Every drill practises the entry id itself, so its
 * outcome lands on the entry in spaced repetition.
 *
 * - Card / verb `drills`: the sentence with the gap, the answer among its distractors.
 * - Verb forms: person label + gap, options = other forms of the same tense (distinct texts),
 *   gloss = the form's gloss. Tenses are mixed; the verb's first tense is picked more often.
 */
import { getGrammarEntry, glossOf, type GlossLang, type GrammarDrill, type Pack, type Playable, type Verb } from "@/lib/content";
import { checkAnswer, scriptRules, type ScriptRules } from "./normalize";
import type { Rng } from "./random";
import type { FillGapExercise } from "./types";

/** Drills each due drillable entry gets in a review session. */
export const REVIEW_DRILLS = 2;
/** Most production slots of a lesson given to drills of read entries (never more than half of them). */
export const LESSON_DRILLS = 2;

/** Most options of a drill, the answer included. */
const MAX_OPTIONS = 4;
/** Weight of the verb's first tense when picking where a drill comes from (other tenses and the verb's own drills: 1). */
const FIRST_TENSE_WEIGHT = 2;

/** One possible drill, before its options are drawn. */
interface Candidate {
  audio: Playable;
  before: string;
  after: string;
  gap: string;
  /** Wrong options to draw from (may repeat the answer or each other: filtered when drawn). */
  wrong: readonly string[];
  gloss: string;
  /** Shown by the feedback sheet: the whole sentence or "person form". */
  solution: string;
}

/** Candidates of one source (a tense, or the entry's `drills`) and how often it is picked. */
interface Bucket {
  weight: number;
  items: Candidate[];
}

/**
 * Up to `count` fill-gap drills for Gramática entry `id` of `pack` (fewer only when the entry has
 * fewer possible drills; none when it is not drillable). Each has `itemIds: [id]`, its audio and
 * at least 2 distinct options with the answer among them. Deterministic for a given `rng` state.
 */
export function grammarDrills(id: string, pack: Pack, gloss: GlossLang, rng: Rng, count: number): FillGapExercise[] {
  const entry = getGrammarEntry(id, pack);
  if (!entry || count <= 0) return [];
  const rules = scriptRules(pack.meta);
  const buckets: Bucket[] =
    entry.kind === "verb"
      ? verbBuckets(entry.verb, gloss)
      : [{ weight: 1, items: (entry.card.drills ?? []).map((d) => sentenceCandidate(d, gloss)) }];

  // Only drills with at least one wrong option that differs from the answer.
  const usable = buckets.map((b) => ({ ...b, items: b.items.filter((c) => distinct(c.gap, c.wrong, rules).length) }));
  return pick(usable, rng, count).map((c): FillGapExercise => {
    const wrong = distinct(c.gap, rng.shuffle(c.wrong), rules).slice(0, MAX_OPTIONS - 1);
    return {
      type: "fill-gap",
      key: `fill-gap:${c.audio.audioKey}`,
      itemIds: [id],
      solution: { text: c.solution, gloss: c.gloss, audio: c.audio },
      gloss: c.gloss,
      before: c.before,
      after: c.after,
      gap: c.gap,
      options: rng.shuffle([c.gap, ...wrong]),
      audio: c.audio,
    };
  });
}

function sentenceCandidate(d: GrammarDrill, gloss: GlossLang): Candidate {
  return {
    audio: d,
    before: d.before,
    after: d.after,
    gap: d.answer,
    wrong: d.distractors,
    gloss: glossOf(d, gloss),
    solution: d.text,
  };
}

/** One bucket per tense (forms with at least one other distinct form), plus the verb's own drills. */
function verbBuckets(verb: Verb, gloss: GlossLang): Bucket[] {
  const buckets: Bucket[] = verb.tenses.map((tense, n) => ({
    weight: n === 0 ? FIRST_TENSE_WEIGHT : 1,
    items: tense.forms.map((form) => ({
      audio: form,
      before: `${form.person} `,
      after: "",
      gap: form.form,
      wrong: tense.forms.filter((f) => f !== form).map((f) => f.form),
      gloss: glossOf(form, gloss),
      solution: `${form.person} ${form.form}`,
    })),
  }));
  if (verb.drills?.length) buckets.push({ weight: 1, items: verb.drills.map((d) => sentenceCandidate(d, gloss)) });
  return buckets;
}

/**
 * `count` candidates: each round takes one from every bucket that still has some, in a weighted
 * random order, so two drills of the same entry come from different tenses when possible.
 */
function pick(buckets: Bucket[], rng: Rng, count: number): Candidate[] {
  const pools = buckets.filter((b) => b.items.length).map((b) => ({ weight: b.weight, left: rng.shuffle(b.items) }));
  const out: Candidate[] = [];
  let round = new Set<(typeof pools)[number]>();
  while (out.length < count) {
    let open = pools.filter((p) => p.left.length && !round.has(p));
    if (!open.length) {
      round = new Set();
      open = pools.filter((p) => p.left.length);
      if (!open.length) break;
    }
    let r = rng.next() * open.reduce((sum, p) => sum + p.weight, 0);
    const chosen = open.find((p) => (r -= p.weight) < 0) ?? open[open.length - 1];
    round.add(chosen);
    out.push(chosen.left.shift()!);
  }
  return out;
}

/** `options` in order, minus any the answer check would take as `answer` or as an option already kept. */
function distinct(answer: string, options: readonly string[], rules: ScriptRules): string[] {
  const kept: string[] = [];
  for (const o of options) {
    if ([answer, ...kept].some((k) => checkAnswer(o, k, rules).correct || checkAnswer(k, o, rules).correct)) continue;
    kept.push(o);
  }
  return kept;
}
