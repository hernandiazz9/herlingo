/**
 * Validates and normalises one language pack. Pure: takes already-read JSON, returns the pack
 * plus a list of errors. Used by `scripts/content.ts` only (the app never imports zod).
 */
import type { z } from "zod";
import { audioKey, vocabText } from "./keys";
import * as S from "./schema";
import { stressIssues } from "./script";
import type {
  Dialogue,
  Expression,
  GrammarCard,
  ImageRef,
  LessonItemKind,
  Level,
  Pack,
  Phrase,
  PlacementQuestion,
  QA,
  Story,
  StoryGap,
  StoryKeyword,
  Unit,
  Vocab,
} from "./types";

/** Story guidelines: outside these ranges `content:check` warns (never fails). */
export const STORY_GUIDE = {
  words: [80, 150],
  keywords: [8, 10],
  questions: [3, 4],
  gaps: [4, 6],
} as const;

/** Prefix required on vocab items defined inline in a story file. */
export const STORY_VOCAB_PREFIX = "story-";

/** Words in a text: whitespace-separated tokens that contain a letter or digit. */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
}

/**
 * Index of the first whole-word, case-insensitive occurrence of `word` in `text`, or -1. A
 * combining mark (a stress mark) counts as part of the word: an unmarked gap never matches a marked word.
 */
function findWord(text: string, word: string): number {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])${escaped}(?![\\p{L}\\p{M}\\p{N}])`, "iu").exec(text);
  return m ? m.index : -1;
}

export interface SourceFile {
  /** Path relative to the repo root, used in error messages. */
  file: string;
  data: unknown;
}

export interface PackSources {
  lang: string;
  meta: SourceFile;
  units: SourceFile[];
  dialogues: SourceFile[];
  extras: SourceFile[];
  stories: SourceFile[];
  /**
   * Resolves a picture key to its public file (`scripts/content.ts` reads
   * `public/images/manifest.json`). Returns undefined when the file does not exist yet: the item
   * then simply has no `image`. Omitted = no pictures resolved.
   */
  resolveImage?: (key: string) => ImageRef | undefined;
}

export interface BuildResult {
  pack: Pack | null;
  /**
   * Every id the pack claims (units, lessons, items, dialogues, stories, placement) → the file
   * that defines it. Ids must be unique across packs: `scripts/content.ts` compares these maps.
   */
  ids: Map<string, string>;
  errors: string[];
  /** Guideline misses (e.g. story length): reported, never fatal. */
  warnings: string[];
}

function parse<T extends z.ZodType>(schema: T, src: SourceFile, errors: string[]): z.infer<T> | null {
  const res = schema.safeParse(src.data);
  if (res.success) return res.data;
  for (const issue of res.error.issues) {
    errors.push(`${src.file}: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  return null;
}

export function buildPack(src: PackSources): BuildResult {
  const errors: string[] = [];
  const schemaErrors: string[] = [];
  const meta = parse(S.PackMeta, src.meta, schemaErrors);
  const warnings: string[] = [];
  if (!meta) return { pack: null, ids: new Map(), errors: schemaErrors, warnings };
  if (meta.lang !== src.lang) errors.push(`${src.meta.file}: lang "${meta.lang}" must equal folder name "${src.lang}"`);

  const defaultVoice = meta.voices[0];
  const situations = new Set<string>();
  for (const s of meta.situations) {
    if (situations.has(s.id)) errors.push(`${src.meta.file}: duplicate situation "${s.id}"`);
    situations.add(s.id);
  }

  // One id namespace for everything in the pack.
  const owners = new Map<string, string>();
  const kinds = new Map<string, LessonItemKind | "unit" | "lesson" | "dialogue" | "placement" | "story">();
  const claim = (id: string, kind: Parameters<typeof kinds.set>[1], file: string) => {
    const prev = owners.get(id);
    if (prev) errors.push(`${file}: duplicate id "${id}" (already used in ${prev})`);
    else {
      owners.set(id, file);
      kinds.set(id, kind);
    }
  };
  const checkVoice = (voice: string | undefined, where: string) => {
    if (voice && !meta.voices.includes(voice)) errors.push(`${where}: voice "${voice}" is not in pack.json voices`);
    return voice ?? defaultVoice;
  };
  const checkSituation = (situation: string | undefined, where: string) => {
    if (situation && !situations.has(situation)) errors.push(`${where}: unknown situation "${situation}"`);
  };
  const registers = new Set<string>(["tu", "neutral", meta.formalRegister]);
  const checkRegister = (register: string, where: string) => {
    if (!registers.has(register)) {
      errors.push(`${where}: register "${register}" is not allowed in this pack (use ${[...registers].map((r) => `"${r}"`).join(", ")})`);
    }
  };
  // Levels: a pack with `levels` puts a level on every unit, dialogue, story and placement
  // question; a pack without them is one course (stories keep their own informative level).
  const levels = new Set<string>(meta.levels ?? []);
  if (meta.levels && levels.size !== meta.levels.length) errors.push(`${src.meta.file}: duplicate level in "levels"`);
  const levelList = (meta.levels ?? []).map((l) => `"${l}"`).join(", ");
  /** Checks `level` and returns the level to store (undefined in a pack without levels). */
  const checkLevel = (level: Level | undefined, where: string, optionalWithoutLevels = false): Level | undefined => {
    if (!meta.levels) {
      if (level !== undefined && !optionalWithoutLevels) {
        errors.push(`${where}: "level" is only allowed when pack.json has "levels"`);
      }
      return undefined;
    }
    if (level === undefined) errors.push(`${where}: "level" is required (pack.json levels: ${levelList})`);
    else if (!levels.has(level)) errors.push(`${where}: level "${level}" is not in pack.json levels (${levelList})`);
    return level;
  };
  const articles = new Set(meta.articles ?? []);
  const checkArticle = (article: string | undefined, where: string) => {
    if (article === undefined) return;
    if (!meta.articles) errors.push(`${where}: "article" is only allowed when pack.json has "articles"`);
    else if (!articles.has(article)) {
      errors.push(`${where}: article "${article}" is not in pack.json articles (${meta.articles.map((a) => `"${a}"`).join(", ")})`);
    }
  };
  /** Pack `stress` rule on target-language text (no-op for a pack without `stress`). */
  const checkStress = (text: string | undefined, where: string) => {
    if (!meta.stress || text === undefined) return;
    for (const { word, problem } of stressIssues(text, meta)) errors.push(`${where}: "${word}": ${problem}`);
  };
  for (const [n, word] of Object.entries(meta.numberWords ?? {})) checkStress(word, `${src.meta.file}: numberWords "${n}"`);

  const phrases: Phrase[] = [];
  const vocab: Vocab[] = [];
  const qa: QA[] = [];
  const grammar: GrammarCard[] = [];
  const expressions: Expression[] = [];
  const placement: PlacementQuestion[] = [];

  const resolveImage = (key: string | undefined) => (key ? src.resolveImage?.(key) : undefined);

  const addVocab = (file: string, v: z.infer<typeof S.Vocab>, level?: Level) => {
    const where = `${file}: vocab "${v.id}"`;
    claim(v.id, "vocab", file);
    checkSituation(v.situation, where);
    checkArticle(v.article, where);
    checkStress(v.word, where);
    checkStress(v.plural, `${where} plural`);
    const { image: imageKey, ...rest } = v;
    vocab.push({
      ...rest,
      ...(level ? { level } : {}),
      kind: "vocab",
      text: vocabText(v.word, v.article),
      audioKey: audioKey(v.id),
      voice: checkVoice(v.voice, where),
      imageKey,
      image: resolveImage(imageKey),
    });
  };

  /** Registers a file's items; `level` = the defining unit's level (packs with `levels`). */
  const addItems = (file: string, f: z.infer<typeof S.ExtrasFile> | z.infer<typeof S.UnitFile>, level?: Level) => {
    const lv = level ? { level } : {};
    for (const p of f.phrases) {
      const where = `${file}: phrase "${p.id}"`;
      claim(p.id, "phrase", file);
      checkSituation(p.situation, where);
      checkRegister(p.register, where);
      checkStress(p.text, where);
      phrases.push({ ...p, ...lv, kind: "phrase", audioKey: audioKey(p.id), voice: checkVoice(p.voice, where) });
    }
    for (const v of f.vocab) addVocab(file, v, level);
    for (const q of f.qa) {
      const where = `${file}: qa "${q.id}"`;
      claim(q.id, "qa", file);
      checkSituation(q.situation, where);
      checkRegister(q.register, where);
      for (const t of [q.question, ...q.accepted.map((r) => r.text), ...q.distractors.map((r) => r.text)]) checkStress(t, where);
      const voice = checkVoice(q.voice, where);
      qa.push({
        ...q,
        ...lv,
        kind: "qa",
        text: q.question,
        audioKey: audioKey(q.id, "q"),
        voice,
        accepted: q.accepted.map((r, i) => ({ ...r, audioKey: audioKey(q.id, `a${i + 1}`), voice: defaultVoice })),
        distractors: q.distractors.map((r, i) => ({ ...r, audioKey: audioKey(q.id, `d${i + 1}`), voice: defaultVoice })),
      });
    }
    for (const g of f.grammar) {
      claim(g.id, "grammar", file);
      for (const e of g.examples) checkStress(e.text, `${file}: grammar "${g.id}"`);
      grammar.push({
        ...g,
        ...lv,
        kind: "grammar",
        examples: g.examples.map((e, i) => ({ ...e, audioKey: audioKey(g.id, `e${i + 1}`), voice: defaultVoice })),
      });
    }
    for (const x of f.expressions) {
      const where = `${file}: expression "${x.id}"`;
      claim(x.id, "expression", file);
      checkStress(x.text, where);
      expressions.push({ ...x, ...lv, kind: "expression", audioKey: audioKey(x.id), voice: checkVoice(x.voice, where) });
    }
  };

  // Units
  const units: Unit[] = [];
  const unitOrders = new Map<number, string>();
  for (const s of src.units) {
    const u = parse(S.UnitFile, s, schemaErrors);
    if (!u) continue;
    claim(u.id, "unit", s.file);
    checkSituation(u.situation, `${s.file}: unit "${u.id}"`);
    const level = checkLevel(u.level, `${s.file}: unit "${u.id}"`);
    const clash = unitOrders.get(u.order);
    if (clash) errors.push(`${s.file}: unit order ${u.order} already used by unit "${clash}"`);
    unitOrders.set(u.order, u.id);
    for (const l of u.lessons) claim(l.id, "lesson", s.file);
    addItems(s.file, u, level);
    units.push({
      id: u.id,
      order: u.order,
      title: u.title,
      description: u.description,
      emoji: u.emoji,
      situation: u.situation,
      ...(level ? { level } : {}),
      lessons: u.lessons.map((l, index) => ({ ...l, unitId: u.id, index })),
    });
  }

  // Extras
  const rawPlacement: { file: string; q: z.infer<typeof S.PlacementQuestion> }[] = [];
  for (const s of src.extras) {
    const x = parse(S.ExtrasFile, s, schemaErrors);
    if (!x) continue;
    addItems(s.file, x);
    for (const q of x.placement) {
      claim(q.id, "placement", s.file);
      rawPlacement.push({ file: s.file, q });
    }
  }

  // Dialogues
  const dialogues: Dialogue[] = [];
  const rawDialogueUnits: { file: string; id: string; unit?: string }[] = [];
  for (const s of src.dialogues) {
    const d = parse(S.DialogueFile, s, schemaErrors);
    if (!d) continue;
    const where = `${s.file}: dialogue "${d.id}"`;
    claim(d.id, "dialogue", s.file);
    checkSituation(d.situation, where);
    checkRegister(d.register, where);
    checkLevel(d.level, where);
    rawDialogueUnits.push({ file: s.file, id: d.id, unit: d.unit });
    const turnIds = new Set<string>();
    const turns: Dialogue["turns"] = d.turns.map((t) => {
      if (turnIds.has(t.id)) errors.push(`${where}: duplicate turn id "${t.id}"`);
      turnIds.add(t.id);
      if (t.speaker === "native") {
        checkStress(t.text, `${where} turn "${t.id}"`);
        return {
          ...t,
          audioKey: audioKey(d.id, t.id),
          voice: checkVoice(t.voice, `${where} turn "${t.id}"`),
          avatar: resolveImage(t.name ? d.avatars?.[t.name] : undefined),
        };
      }
      for (const o of t.options) checkStress(o.text, `${where} turn "${t.id}"`);
      if (!t.options.some((o) => o.verdict === "correct")) {
        errors.push(`${where}: learner turn "${t.id}" needs at least one "correct" option`);
      }
      return {
        ...t,
        options: t.options.map((o, i) => ({ ...o, audioKey: audioKey(d.id, t.id, i + 1), voice: defaultVoice })),
      };
    });
    if (!turns.some((t) => t.speaker === "learner")) errors.push(`${where}: needs at least one learner turn`);
    const names = new Set(d.turns.flatMap((t) => (t.speaker === "native" && t.name ? [t.name] : [])));
    for (const name of Object.keys(d.avatars ?? {})) {
      if (!names.has(name)) errors.push(`${where}: avatar for "${name}", which is not the name of a native turn`);
    }
    dialogues.push({ ...d, turns });
  }

  // Stories (gaps and key word refs are resolved below, once every item is registered).
  const stories: Story[] = [];
  const rawStories: { file: string; story: Story; raw: z.infer<typeof S.StoryFile> }[] = [];
  const storyOrders = new Map<number, string>();
  for (const s of src.stories) {
    const st = parse(S.StoryFile, s, schemaErrors);
    if (!st) continue;
    const where = `${s.file}: story "${st.id}"`;
    claim(st.id, "story", s.file);
    checkSituation(st.situation, where);
    const storyLevel = checkLevel(st.level, where, true);
    const clash = storyOrders.get(st.order);
    if (clash) errors.push(`${where}: order ${st.order} already used by story "${clash}"`);
    storyOrders.set(st.order, st.id);
    const voice = checkVoice(st.voice, where);
    checkStress(st.title, `${where} title`);
    const localIds = new Set<string>();
    const local = (id: string) => {
      if (localIds.has(id)) errors.push(`${where}: duplicate local id "${id}" (sentences, questions and gaps share one namespace)`);
      localIds.add(id);
    };
    const keywords = st.keywords.map((k) => {
      if (typeof k === "string") return k;
      if (!k.id.startsWith(STORY_VOCAB_PREFIX)) {
        errors.push(`${where}: inline key word "${k.id}" must have an id starting with "${STORY_VOCAB_PREFIX}"`);
      }
      addVocab(s.file, k, storyLevel);
      return k.id;
    });
    if (new Set(keywords).size !== keywords.length) errors.push(`${where}: repeated key word`);
    const sentences = st.sentences.map((x) => {
      local(x.id);
      checkStress(x.text, `${where} sentence "${x.id}"`);
      const v = x.voice ? checkVoice(x.voice, `${where} sentence "${x.id}"`) : voice;
      return { ...x, audioKey: audioKey(st.id, x.id), voice: v };
    });
    const questions = st.questions.map((q) => {
      local(q.id);
      for (const t of [q.question, ...q.options.map((o) => o.text)]) checkStress(t, `${where} question "${q.id}"`);
      if (q.correct >= q.options.length) errors.push(`${where}: question "${q.id}": correct ${q.correct} is out of range`);
      return {
        ...q,
        text: q.question,
        audioKey: audioKey(st.id, q.id),
        voice,
        options: q.options.map((o, i) => ({ ...o, audioKey: audioKey(st.id, q.id, i + 1), voice })),
      };
    });
    for (const g of st.gaps) {
      local(g.id);
      for (const t of [g.gap, ...g.distractors]) checkStress(t, `${where} gap "${g.id}"`);
    }
    const story: Story = {
      id: st.id,
      order: st.order,
      title: st.title,
      titleEs: st.titleEs,
      description: st.description,
      emoji: st.emoji,
      situation: st.situation,
      level: st.level,
      voice,
      sentences,
      keywords,
      questions,
      gaps: [],
      wordCount: sentences.reduce((n, x) => n + countWords(x.text), 0),
    };
    stories.push(story);
    rawStories.push({ file: s.file, story, raw: st });
  }

  // A file that failed its schema was skipped: checking references now would only add
  // misleading "unknown id" errors. Fix the schema errors first.
  if (schemaErrors.length) return { pack: null, ids: owners, errors: [...schemaErrors, ...errors], warnings };

  // References (after everything is registered).
  const allowedInLesson = new Set<string>(S.LESSON_ITEM_KINDS);
  for (const u of units) {
    for (const l of u.lessons) {
      for (const ref of l.items) {
        const kind = kinds.get(ref);
        if (!kind) errors.push(`unit "${u.id}" lesson "${l.id}": unknown item "${ref}"`);
        else if (!allowedInLesson.has(kind)) errors.push(`unit "${u.id}" lesson "${l.id}": "${ref}" is a ${kind}, not a lesson item`);
      }
      if (new Set(l.items).size !== l.items.length) errors.push(`unit "${u.id}" lesson "${l.id}": repeated item`);
    }
  }
  for (const v of vocab) {
    if (v.example && kinds.get(v.example) !== "phrase") errors.push(`vocab "${v.id}": example "${v.example}" is not a phrase id`);
  }
  for (const d of rawDialogueUnits) {
    if (d.unit && kinds.get(d.unit) !== "unit") errors.push(`${d.file}: dialogue "${d.id}": unknown unit "${d.unit}"`);
  }
  for (const { file, q } of rawPlacement) {
    const where = `${file}: placement "${q.id}"`;
    if (q.answer >= q.options.length) errors.push(`${where}: answer ${q.answer} is out of range`);
    for (const t of [q.text, ...q.options]) checkStress(t, where);
    checkLevel(q.level, where);
    for (const l of q.lessons) if (kinds.get(l) !== "lesson") errors.push(`${where}: unknown lesson "${l}"`);
    const { voice, ...rest } = q;
    placement.push({
      ...rest,
      audio: q.text ? { text: q.text, audioKey: audioKey(q.id), voice: checkVoice(voice, where) } : undefined,
    });
  }

  const keywordItems = new Map<string, StoryKeyword>();
  for (const list of [vocab, phrases, expressions]) for (const i of list) keywordItems.set(i.id, i);
  for (const { file, story, raw } of rawStories) {
    const where = `${file}: story "${story.id}"`;
    for (const k of story.keywords) {
      if (!keywordItems.has(k)) {
        const kind = kinds.get(k);
        errors.push(`${where}: key word "${k}" ${kind ? `is a ${kind}, not a vocab, phrase or expression` : "is unknown"}`);
      }
    }
    const sentences = new Map(story.sentences.map((x) => [x.id, x]));
    for (const g of raw.gaps) {
      const at = `${where}: gap "${g.id}"`;
      const sentence = sentences.get(g.sentence);
      if (!sentence) {
        errors.push(`${at}: unknown sentence "${g.sentence}"`);
        continue;
      }
      if (!story.keywords.includes(g.answer)) {
        errors.push(`${at}: answer "${g.answer}" is not one of the story key words`);
        continue;
      }
      const item = keywordItems.get(g.answer);
      if (!item) continue; // already reported above
      const gap = g.gap ?? (item.kind === "vocab" ? item.word : item.text);
      const start = findWord(sentence.text, gap);
      if (start < 0) {
        errors.push(`${at}: "${gap}" is not in sentence "${g.sentence}" (set "gap" to the exact form used)`);
        continue;
      }
      const lower = g.distractors.map((d) => d.toLowerCase());
      if (lower.includes(gap.toLowerCase())) errors.push(`${at}: a distractor equals the answer "${gap}"`);
      if (new Set(lower).size !== lower.length) errors.push(`${at}: repeated distractor`);
      const gapItem: StoryGap = {
        id: g.id,
        sentence: g.sentence,
        answer: g.answer,
        gap: sentence.text.slice(start, start + gap.length),
        before: sentence.text.slice(0, start),
        after: sentence.text.slice(start + gap.length),
        distractors: g.distractors,
      };
      story.gaps.push(gapItem);
    }
    const counts = {
      words: story.wordCount,
      keywords: story.keywords.length,
      questions: story.questions.length,
      gaps: raw.gaps.length,
    };
    const misses = (Object.keys(STORY_GUIDE) as (keyof typeof STORY_GUIDE)[])
      .filter((k) => counts[k] < STORY_GUIDE[k][0] || counts[k] > STORY_GUIDE[k][1])
      .map((k) => `${counts[k]} ${k} (guideline ${STORY_GUIDE[k][0]}–${STORY_GUIDE[k][1]})`);
    if (misses.length) warnings.push(`${where}: ${misses.join(", ")}`);
  }

  units.sort((a, b) => a.order - b.order);
  dialogues.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  stories.sort((a, b) => a.order - b.order);

  const pack: Pack = { meta, units, dialogues, stories, phrases, vocab, qa, grammar, expressions, placement };
  return { pack: errors.length ? null : pack, ids: owners, errors, warnings };
}

/** Counts for the content:check summary. */
export function packStats(p: Pack) {
  return {
    units: p.units.length,
    lessons: p.units.reduce((n, u) => n + u.lessons.length, 0),
    phrases: p.phrases.length,
    vocab: p.vocab.length,
    qa: p.qa.length,
    grammar: p.grammar.length,
    expressions: p.expressions.length,
    dialogues: p.dialogues.length,
    placement: p.placement.length,
    stories: p.stories.length,
    explanations: p.phrases.filter((x) => x.explanation).length,
    pictures: p.vocab.filter((x) => x.image).length,
  };
}
