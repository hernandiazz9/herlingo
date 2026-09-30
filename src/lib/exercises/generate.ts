/**
 * Session generator: turns a lesson's items into ~10–12 mixed exercises.
 * Deterministic: the same lesson, pack, seed and options always give the same session.
 *
 * Shape of a session: recognition first (listen/read the meaning, answer the question) in
 * teaching order, then one "match the pairs", then production (tiles, fill the gap, dictation,
 * say it aloud) in shuffled order. Grammar cards become ungraded tip steps. Sicilian expressions
 * are recognition-only.
 */
import { getLessonItems, type Expression, type Lesson, type LessonItem, type Pack, type Phrase, type QA, type Vocab } from "@/lib/content";
import { normalizeAnswer, toTiles } from "./normalize";
import { createRng, type Rng } from "./random";
import type { ChoiceOption, Exercise, ExerciseType, GrammarStep, MatchPair, SessionStep } from "./types";

export interface GenerateOptions {
  seed: string;
  /** Include "say it aloud" exercises. */
  speaking?: boolean;
  /** Graded exercises wanted; defaults to 10 (short lessons) or 12. */
  size?: number;
}

type Meaningful = Phrase | Vocab | Expression;
type Practisable = Meaningful | QA;

const MAX_TILE_WORDS = 10;
const MAX_DICTATION_WORDS = 7;
const MATCH_PAIRS = 5;
const MIN_MATCH_PAIRS = 4;

const wordsOf = (text: string) => toTiles(text).length;
const isMeaningful = (i: LessonItem): i is Meaningful =>
  i.kind === "phrase" || i.kind === "vocab" || i.kind === "expression";

/** Default session size for a lesson with `n` practisable items. */
export function defaultSessionSize(n: number): number {
  return n >= 8 ? 12 : 10;
}

export function generateSession(lesson: Lesson, pack: Pack, options: GenerateOptions): SessionStep[] {
  const rng = createRng(`${lesson.id}|${options.seed}`);
  const speaking = options.speaking ?? true;
  const all = getLessonItems(lesson, pack);
  const items = all.filter((i): i is Practisable => i.kind !== "grammar");
  if (!items.length) return all.filter((i) => i.kind === "grammar").map((card) => ({ type: "grammar", key: `grammar:${card.id}`, card }));

  const ctx = new Ctx(rng, pack, items);
  const target = options.size ?? defaultSessionSize(items.length);

  // 1. Match the pairs: vocab first, then short phrases/expressions.
  const matchPool = [
    ...items.filter((i): i is Vocab => i.kind === "vocab"),
    ...items.filter((i): i is Meaningful => (i.kind === "phrase" || i.kind === "expression") && wordsOf(i.text) <= 3),
  ];
  const match = ctx.match(matchPool);
  const matched = new Set(match?.itemIds ?? []);
  const slots = Math.max(1, target - (match ? 1 : 0));

  // 2. Recognition, teaching order, for items not in the match (at most ~60% of the slots).
  // Evenly spread over the lesson so the last items (often the Q&A) are not always left out.
  const recPool = items.filter((i) => !matched.has(i.id));
  const recCount = Math.min(recPool.length, Math.ceil(slots * 0.6));
  const recItems = Array.from({ length: recCount }, (_, n) => recPool[Math.floor((n * recPool.length) / recCount)]);
  const rec = recItems.map((i) => ctx.recognition(i));
  const covered = new Set([...recItems.map((i) => i.id), ...matched]);

  // 3. Production: uncovered items first (teaching order), then the rest shuffled, cycling.
  const prod: Exercise[] = [];
  const firstRound = [...items.filter((i) => !covered.has(i.id)), ...rng.shuffle(items.filter((i) => covered.has(i.id)))];
  for (let round = 0; prod.length < slots - rec.length && round < 6; round++) {
    const order = round === 0 ? firstRound : rng.shuffle(items);
    for (const item of order) {
      if (prod.length >= slots - rec.length) break;
      prod.push(ctx.production(item, speaking));
    }
  }

  const exercises: Exercise[] = [...rec, ...(match ? [match] : []), ...prod];

  // 4. Grammar tips: after the last recognition exercise that comes before the card in teaching order.
  const steps: SessionStep[] = [...exercises];
  const position = new Map(all.map((i, n) => [i.id, n]));
  const grammar = all.filter((i) => i.kind === "grammar");
  for (const card of grammar.reverse()) {
    const at = position.get(card.id) ?? 0;
    let insert = 0;
    rec.forEach((ex, n) => {
      if ((position.get(ex.itemIds[0]) ?? 0) < at) insert = n + 1;
    });
    const step: GrammarStep = { type: "grammar", key: `grammar:${card.id}`, card };
    steps.splice(insert, 0, step);
  }
  return steps;
}

/** Generation state: rng, distractor pools and type counters (for variety). */
class Ctx {
  private used = new Map<ExerciseType, number>();
  private perItem = new Map<string, Set<ExerciseType>>();
  private n = 0;
  private meaningPool: Meaningful[];
  private wordPool: string[];

  constructor(
    private rng: Rng,
    pack: Pack,
    private items: Practisable[],
  ) {
    const lessonMeaningful = items.filter(isMeaningful);
    const lessonIds = new Set(items.map((i) => i.id));
    const packMeaningful = [...pack.phrases, ...pack.vocab, ...pack.expressions].filter((i) => !lessonIds.has(i.id));
    // Lesson items first so distractors are on topic; the pack fills the gaps.
    this.meaningPool = [...rng.shuffle(lessonMeaningful), ...rng.shuffle(packMeaningful)];
    // Standard-language words only (no Sicilian expressions) for tiles and gap options.
    const lessonWords = items.filter((i) => i.kind === "phrase" || i.kind === "vocab").flatMap((i) => sentenceTiles(i.text));
    const packWords = rng.shuffle(pack.phrases.flatMap((p) => sentenceTiles(p.text)));
    // One spelling per word, so options and tiles never show the same word twice.
    const seen = new Set<string>();
    this.wordPool = [...rng.shuffle(lessonWords), ...packWords].filter((w) => {
      const k = normalizeAnswer(w);
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  private key(type: ExerciseType, ids: string[]) {
    this.used.set(type, (this.used.get(type) ?? 0) + 1);
    for (const id of ids) {
      const set = this.perItem.get(id) ?? new Set();
      set.add(type);
      this.perItem.set(id, set);
    }
    return `${type}:${ids.join(",")}:${this.n++}`;
  }

  /** Least used type overall, preferring types this item has not had yet; ties broken by rng. */
  private choose(item: Practisable, types: ExerciseType[]): ExerciseType {
    const had = this.perItem.get(item.id) ?? new Set();
    const score = (t: ExerciseType) => (had.has(t) ? 100 : 0) + (this.used.get(t) ?? 0);
    const shuffled = this.rng.shuffle(types);
    return shuffled.reduce((best, t) => (score(t) < score(best) ? t : best), shuffled[0]);
  }

  recognition(item: Practisable): Exercise {
    if (item.kind === "qa") return this.answer(item);
    return this.build(item, this.choose(item, ["listen-meaning", "read-meaning"]));
  }

  production(item: Practisable, speaking: boolean): Exercise {
    const types: ExerciseType[] = [];
    if (item.kind === "qa") {
      types.push("answer");
      if (speaking) types.push("speak");
    } else if (item.kind === "expression") {
      types.push("listen-meaning", "read-meaning");
    } else {
      const words = wordsOf(item.text);
      if (item.kind === "phrase" && words >= 2 && words <= MAX_TILE_WORDS) types.push("tiles");
      if (item.kind === "phrase" && words >= 2) types.push("fill-gap");
      if (words <= MAX_DICTATION_WORDS) types.push("dictation");
      if (speaking) types.push("speak");
      // Single words: add recognition so the session stays varied.
      if (types.length < 3) types.push("listen-meaning", "read-meaning");
    }
    const type = this.choose(item, types);
    return item.kind === "qa" ? (type === "speak" ? this.speakQa(item) : this.answer(item)) : this.build(item, type);
  }

  private build(item: Meaningful, type: ExerciseType): Exercise {
    const ids = [item.id];
    const solution = { text: item.text, es: item.es, audio: item };
    switch (type) {
      case "listen-meaning":
      case "read-meaning":
        return { type, key: this.key(type, ids), itemIds: ids, solution, audio: item, options: this.meaningOptions(item) };
      case "tiles": {
        const answerTiles = sentenceTiles(item.text);
        const taken = new Set(answerTiles.map((w) => normalizeAnswer(w)));
        const extra = this.wordPool.filter((w) => !taken.has(normalizeAnswer(w))).slice(0, answerTiles.length > 4 ? 3 : 2);
        this.wordPool = rotate(this.wordPool, extra.length);
        return {
          type,
          key: this.key(type, ids),
          itemIds: ids,
          solution,
          es: item.es,
          answer: item.text,
          tiles: this.rng.shuffle([...answerTiles, ...extra]),
          audio: item,
        };
      }
      case "fill-gap": {
        const raw = item.text.split(/\s+/);
        const cores = raw.map((w) => toTiles(w)[0] ?? "");
        const candidates = cores.map((c, n) => [c, n] as const).filter(([c]) => c.replace(/['’]/g, "").length >= 3);
        const [gap, index] = candidates.length ? this.rng.pick(candidates) : [cores[0], 0];
        const token = raw[index];
        const at = token.indexOf(gap);
        // Exact spacing around the gap: render as `before + gap + after`.
        const before = raw.slice(0, index).join(" ") + (index > 0 ? " " : "") + token.slice(0, at);
        const after = token.slice(at + gap.length) + (index < raw.length - 1 ? " " : "") + raw.slice(index + 1).join(" ");
        const g = normalizeAnswer(gap);
        const extra = this.wordPool.filter((w) => normalizeAnswer(w) !== g && w.length >= 2).slice(0, 3);
        this.wordPool = rotate(this.wordPool, extra.length);
        return {
          type,
          key: this.key(type, ids),
          itemIds: ids,
          solution,
          es: item.es,
          before,
          after,
          gap,
          options: this.rng.shuffle([gap, ...extra]),
          audio: item,
        };
      }
      case "dictation": {
        const accepted = item.kind === "vocab" ? unique([item.text, item.word]) : [item.text];
        return { type, key: this.key(type, ids), itemIds: ids, solution, audio: item, accepted, es: item.es };
      }
      case "speak":
        return { type, key: this.key(type, ids), itemIds: ids, solution, audio: item, es: item.es };
      default:
        return this.build(item, "read-meaning");
    }
  }

  private meaningOptions(item: Meaningful): ChoiceOption[] {
    const right = normalizeAnswer(item.es, true);
    const seen = new Set([right]);
    const sameKind = this.meaningPool.filter((p) => p.kind === item.kind);
    const others = this.meaningPool.filter((p) => p.kind !== item.kind);
    const distractors: ChoiceOption[] = [];
    for (const p of [...sameKind, ...others]) {
      if (distractors.length >= 3) break;
      const key = normalizeAnswer(p.es, true);
      if (p.id === item.id || seen.has(key)) continue;
      seen.add(key);
      distractors.push({ id: p.id, label: p.es, correct: false });
    }
    this.meaningPool = rotate(this.meaningPool, 3);
    return this.rng.shuffle([{ id: item.id, label: item.es, correct: true }, ...distractors]);
  }

  private answer(item: QA): Exercise {
    const ids = [item.id];
    const reply = this.rng.pick(item.accepted);
    const options: ChoiceOption[] = [
      { id: reply.audioKey, label: reply.text, correct: true, audio: reply },
      ...this.rng.shuffle(item.distractors).slice(0, 3).map((d) => ({ id: d.audioKey, label: d.text, correct: false, audio: d })),
    ];
    return {
      type: "answer",
      key: this.key("answer", ids),
      itemIds: ids,
      solution: { text: reply.text, es: reply.es, audio: reply, note: `«${item.text}» = ${item.questionEs}` },
      question: item,
      questionEs: item.questionEs,
      options: this.rng.shuffle(options),
    };
  }

  private speakQa(item: QA): Exercise {
    const reply = item.accepted[0];
    const ids = [item.id];
    return {
      type: "speak",
      key: this.key("speak", ids),
      itemIds: ids,
      solution: { text: reply.text, es: reply.es, audio: reply },
      audio: reply,
      es: reply.es,
    };
  }

  match(pool: Meaningful[]): Exercise | undefined {
    const pairs: MatchPair[] = [];
    const its = new Set<string>();
    const ess = new Set<string>();
    for (const item of pool) {
      if (pairs.length >= MATCH_PAIRS) break;
      const it = normalizeAnswer(item.text, true);
      const es = normalizeAnswer(item.es, true);
      if (its.has(it) || ess.has(es)) continue;
      its.add(it);
      ess.add(es);
      pairs.push({ id: item.id, it: item.text, es: item.es, audio: item });
    }
    if (pairs.length < MIN_MATCH_PAIRS || this.items.length < MIN_MATCH_PAIRS) return undefined;
    const ids = pairs.map((p) => p.id);
    return {
      type: "match",
      key: this.key("match", ids),
      itemIds: ids,
      solution: { text: pairs.map((p) => `${p.it} = ${p.es}`).join(" · ") },
      pairs,
      itOrder: this.rng.shuffle(ids),
      esOrder: this.rng.shuffle(ids),
    };
  }
}

/** Tiles with the sentence-initial capital removed, so capitals do not give the order away. */
function sentenceTiles(text: string): string[] {
  return toTiles(text).map((w, n) => (n === 0 ? w.charAt(0).toLowerCase() + w.slice(1) : w));
}

function unique<T>(list: T[]): T[] {
  return [...new Set(list)];
}

/** Moves the first `n` entries to the end, so consecutive exercises get different distractors. */
function rotate<T>(list: T[], n: number): T[] {
  if (!list.length) return list;
  const k = n % list.length;
  return [...list.slice(k), ...list.slice(0, k)];
}
