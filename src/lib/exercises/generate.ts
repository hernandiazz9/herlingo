/**
 * Session generator: turns a lesson's items into ~10–12 mixed exercises.
 * Deterministic: the same lesson, pack, seed and options always give the same session.
 *
 * Shape of a session: recognition first (listen/read the meaning, answer the question) in
 * teaching order, then one "match the pairs", then production (tiles, fill the gap, dictation,
 * say it aloud) in shuffled order. Grammar cards become ungraded tip steps. Sicilian expressions
 * are recognition-only.
 *
 * Pictures: vocab words with an `image` can also get "pick the picture" exercises (Spanish prompt or
 * target-language audio only), and the match uses pictures when >= 3 lesson words have one. With `known`,
 * a new-word card comes before the first exercise of each vocab word never seen before.
 */
import {
  getLessonItems,
  glossOf,
  hasImage,
  listVocab,
  type Expression,
  type GlossLang,
  type Lesson,
  type LessonItem,
  type Pack,
  type Phrase,
  type PicturedVocab,
  type QA,
  type Vocab,
} from "@/lib/content";
import { normalizeAnswer, toTiles } from "./normalize";
import { createRng, type Rng } from "./random";
import type { ChoiceOption, Exercise, ExerciseType, GrammarStep, IntroStep, MatchPair, PictureOption, SessionStep } from "./types";

export interface GenerateOptions {
  seed: string;
  /** The learner's gloss language: every meaning shown or compared is `glossOf(item, gloss)`. */
  gloss: GlossLang;
  /** Include "say it aloud" exercises. */
  speaking?: boolean;
  /** Graded exercises wanted; defaults to 10 (short lessons) or 12. */
  size?: number;
  /**
   * Whether the learner has seen an item before (progress / SRS). When given, each vocab word
   * that is not known gets a new-word intro step before its first exercise.
   */
  known?: (itemId: string) => boolean;
}

type Meaningful = Phrase | Vocab | Expression;
type Practisable = Meaningful | QA;

const MAX_TILE_WORDS = 10;
const MAX_DICTATION_WORDS = 7;
const MATCH_PAIRS = 5;
const MIN_MATCH_PAIRS = 4;
const PICTURE_MATCH_PAIRS = 4;
const MIN_PICTURE_MATCH_PAIRS = 3;
/** Picture cards per picture-choice exercise (2x2). */
const PICTURE_OPTIONS = 4;
const PICTURE_TYPES: ExerciseType[] = ["picture-choice", "picture-listen"];

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

  const ctx = new Ctx(rng, pack, items, options.gloss);
  const target = options.size ?? defaultSessionSize(items.length);

  // 1. Match the pairs: with pictures when >= 3 lesson words have one; else vocab first, then
  // short phrases/expressions, then pictured vocab (left for the picture exercises when possible).
  const matchPool = [
    ...items.filter((i): i is Vocab => i.kind === "vocab" && !hasImage(i)),
    ...items.filter((i): i is Meaningful => (i.kind === "phrase" || i.kind === "expression") && wordsOf(i.text) <= 3),
    ...items.filter(hasImage),
  ];
  const match = ctx.pictureMatch(items.filter(hasImage)) ?? ctx.match(matchPool);
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

  // 5. New words: an intro card before the first exercise that practises each unseen vocab word.
  if (!options.known) return steps;
  const vocab = new Map(items.filter((i): i is Vocab => i.kind === "vocab").map((i) => [i.id, i]));
  const introduced = new Set<string>();
  const out: SessionStep[] = [];
  for (const step of steps) {
    if (step.type !== "grammar" && step.type !== "intro") {
      for (const id of step.itemIds) {
        const word = vocab.get(id);
        if (!word || introduced.has(id) || options.known(id)) continue;
        introduced.add(id);
        const intro: IntroStep = { type: "intro", key: `intro:${id}`, item: word };
        out.push(intro);
      }
    }
    out.push(step);
  }
  return out;
}

/** Generation state: rng, distractor pools and type counters (for variety). */
class Ctx {
  private used = new Map<ExerciseType, number>();
  private perItem = new Map<string, Set<ExerciseType>>();
  private n = 0;
  private meaningPool: Meaningful[];
  private wordPool: string[];
  /** Pictured words for picture options: the lesson's, then the rest of the pack. */
  private lessonPictured: PicturedVocab[];
  private packPictured: PicturedVocab[];

  constructor(
    private rng: Rng,
    pack: Pack,
    private items: Practisable[],
    private gloss: GlossLang,
  ) {
    const lessonPicturedIds = new Set(items.filter(hasImage).map((i) => i.id));
    this.lessonPictured = rng.shuffle(items.filter(hasImage));
    // Not shuffled here (shuffled per use), so lessons without pictures get the same sessions as before.
    this.packPictured = listVocab({ withImage: true }, pack).filter((v) => !lessonPicturedIds.has(v.id));
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

  /** The item's translation in the learner's gloss language. */
  private t(item: object): string {
    return glossOf(item, this.gloss);
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

  /** Picture types for pictured vocab that has enough distinct pictures for the options. */
  private pictureTypes(item: Practisable): ExerciseType[] {
    return hasImage(item) && this.pictureDistractors(item).length >= PICTURE_OPTIONS - 1 ? PICTURE_TYPES : [];
  }

  recognition(item: Practisable): Exercise {
    if (item.kind === "qa") return this.answer(item);
    return this.build(item, this.choose(item, ["listen-meaning", "read-meaning", ...this.pictureTypes(item)]));
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
      if (types.length < 3) types.push("listen-meaning", "read-meaning", ...this.pictureTypes(item));
    }
    const type = this.choose(item, types);
    return item.kind === "qa" ? (type === "speak" ? this.speakQa(item) : this.answer(item)) : this.build(item, type);
  }

  private build(item: Meaningful, type: ExerciseType): Exercise {
    const ids = [item.id];
    const solution = { text: item.text, gloss: this.t(item), audio: item };
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
          gloss: this.t(item),
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
          gloss: this.t(item),
          before,
          after,
          gap,
          options: this.rng.shuffle([gap, ...extra]),
          audio: item,
        };
      }
      case "dictation": {
        const accepted = item.kind === "vocab" ? unique([item.text, item.word]) : [item.text];
        return { type, key: this.key(type, ids), itemIds: ids, solution, audio: item, accepted, gloss: this.t(item) };
      }
      case "speak":
        return { type, key: this.key(type, ids), itemIds: ids, solution, audio: item, gloss: this.t(item) };
      case "picture-choice":
      case "picture-listen": {
        const distractors = hasImage(item) ? this.pictureDistractors(item) : [];
        if (!hasImage(item) || distractors.length < PICTURE_OPTIONS - 1) return this.build(item, "read-meaning");
        // Lesson distractors vary between exercises.
        this.lessonPictured = rotate(this.lessonPictured, 1);
        const option = (v: PicturedVocab, correct: boolean): PictureOption => ({
          id: v.id,
          text: v.text,
          gloss: this.t(v),
          image: v.image,
          audio: v,
          correct,
        });
        return {
          type,
          key: this.key(type, ids),
          itemIds: ids,
          solution,
          audio: item,
          gloss: this.t(item),
          options: this.rng.shuffle([option(item, true), ...distractors.map((d) => option(d, false))]),
        };
      }
      default:
        return this.build(item, "read-meaning");
    }
  }

  /**
   * Up to 3 pictured words that can stand next to `item` in a picture choice: same lesson first,
   * then the same situation, then the pack; never the same picture, target-language text or meaning twice.
   */
  private pictureDistractors(item: PicturedVocab): PicturedVocab[] {
    const srcs = new Set([item.image.src]);
    const texts = new Set([normalizeAnswer(item.text, true)]);
    const meanings = new Set([normalizeAnswer(this.t(item), true)]);
    const sameSituation = this.packPictured.filter((v) => v.situation === item.situation);
    const rest = this.packPictured.filter((v) => v.situation !== item.situation);
    const out: PicturedVocab[] = [];
    for (const v of [...this.lessonPictured, ...this.rng.shuffle(sameSituation), ...this.rng.shuffle(rest)]) {
      if (out.length >= PICTURE_OPTIONS - 1) break;
      const t = normalizeAnswer(v.text, true);
      const m = normalizeAnswer(this.t(v), true);
      if (v.id === item.id || srcs.has(v.image.src) || texts.has(t) || meanings.has(m)) continue;
      srcs.add(v.image.src);
      texts.add(t);
      meanings.add(m);
      out.push(v);
    }
    return out;
  }

  private meaningOptions(item: Meaningful): ChoiceOption[] {
    const right = normalizeAnswer(this.t(item), true);
    const seen = new Set([right]);
    const sameKind = this.meaningPool.filter((p) => p.kind === item.kind);
    const others = this.meaningPool.filter((p) => p.kind !== item.kind);
    const distractors: ChoiceOption[] = [];
    for (const p of [...sameKind, ...others]) {
      if (distractors.length >= 3) break;
      const key = normalizeAnswer(this.t(p), true);
      if (p.id === item.id || seen.has(key)) continue;
      seen.add(key);
      distractors.push({ id: p.id, label: this.t(p), correct: false });
    }
    this.meaningPool = rotate(this.meaningPool, 3);
    return this.rng.shuffle([{ id: item.id, label: this.t(item), correct: true }, ...distractors]);
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
      solution: { text: reply.text, gloss: this.t(reply), audio: reply, note: `«${item.text}» = ${glossOf(item, this.gloss, "question")}` },
      question: item,
      questionGloss: glossOf(item, this.gloss, "question"),
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
      solution: { text: reply.text, gloss: this.t(reply), audio: reply },
      audio: reply,
      gloss: this.t(reply),
    };
  }

  /** Target-language words and pictures: 3-4 pairs from the lesson's pictured words (distinct pictures). */
  pictureMatch(pool: PicturedVocab[]): Exercise | undefined {
    const pairs: MatchPair[] = [];
    const srcs = new Set<string>();
    const its = new Set<string>();
    for (const item of this.rng.shuffle(pool)) {
      if (pairs.length >= PICTURE_MATCH_PAIRS) break;
      const it = normalizeAnswer(item.text, true);
      if (srcs.has(item.image.src) || its.has(it)) continue;
      srcs.add(item.image.src);
      its.add(it);
      pairs.push({ id: item.id, text: item.text, gloss: this.t(item), audio: item, image: item.image });
    }
    if (pairs.length < MIN_PICTURE_MATCH_PAIRS) return undefined;
    const ids = pairs.map((p) => p.id);
    return {
      type: "match",
      key: this.key("match", ids),
      itemIds: ids,
      solution: { text: pairs.map((p) => `${p.text} = ${p.gloss}`).join(" · ") },
      pairs,
      textOrder: this.rng.shuffle(ids),
      glossOrder: this.rng.shuffle(ids),
    };
  }

  match(pool: Meaningful[]): Exercise | undefined {
    const pairs: MatchPair[] = [];
    const its = new Set<string>();
    const meanings = new Set<string>();
    for (const item of pool) {
      if (pairs.length >= MATCH_PAIRS) break;
      const it = normalizeAnswer(item.text, true);
      const meaning = normalizeAnswer(this.t(item), true);
      if (its.has(it) || meanings.has(meaning)) continue;
      its.add(it);
      meanings.add(meaning);
      pairs.push({ id: item.id, text: item.text, gloss: this.t(item), audio: item });
    }
    if (pairs.length < MIN_MATCH_PAIRS || this.items.length < MIN_MATCH_PAIRS) return undefined;
    const ids = pairs.map((p) => p.id);
    return {
      type: "match",
      key: this.key("match", ids),
      itemIds: ids,
      solution: { text: pairs.map((p) => `${p.text} = ${p.gloss}`).join(" · ") },
      pairs,
      textOrder: this.rng.shuffle(ids),
      glossOrder: this.rng.shuffle(ids),
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
