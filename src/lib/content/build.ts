/**
 * Validates and normalises one language pack. Pure: takes already-read JSON, returns the pack
 * plus a list of errors. Used by `scripts/content.ts` only (the app never imports zod).
 */
import type { z } from "zod";
import { GLOSS_LANG_CODES, glossLangsOf, glossSuffix, type GlossBase, type GlossLang, type GlossMap, type GlossText } from "./gloss";
import { audioKey, vocabText } from "./keys";
import * as S from "./schema";
import { stressIssues } from "./script";
import { otherVoice, rotatedVoice, speakerVoices } from "./voices";
import type {
  Dialogue,
  Expression,
  GrammarCard,
  GrammarDrill,
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
  Verb,
  VerbTense,
  Vocab,
} from "./types";

/** Prefix of every verb id (`verb.essere`; other packs add their language: `verb.fr-etre`). */
export const VERB_ID_PREFIX = "verb.";

/** The gap marker of a grammar drill sentence. */
export const DRILL_GAP = "___";

/** Story guidelines: outside these ranges `content:check` warns (never fails). */
export const STORY_GUIDE = {
  words: [80, 150],
  keywords: [8, 10],
  questions: [3, 4],
  gaps: [4, 6],
} as const;

/** Story length per CEFR level (words); levels not listed use `STORY_GUIDE.words` (A1–B1). */
export const STORY_WORDS_BY_LEVEL: Partial<Record<Level, readonly [number, number]>> = {
  B2: [100, 200],
  C1: [120, 250],
};

/** The story guidelines for a story of `level` (only the word range depends on it). */
export function storyGuide(level: Level): Record<keyof typeof STORY_GUIDE, readonly [number, number]> {
  return { ...STORY_GUIDE, words: STORY_WORDS_BY_LEVEL[level] ?? STORY_GUIDE.words };
}

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
  /** `verbs/*.json` (Gramática); omitted = none. */
  verbs?: SourceFile[];
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
  const rotation = meta.voiceRotation === true;
  if (rotation && meta.voices.length < 2) errors.push(`${src.meta.file}: "voiceRotation" needs at least 2 "voices"`);
  const situations = new Set<string>();
  for (const s of meta.situations) {
    if (situations.has(s.id)) errors.push(`${src.meta.file}: duplicate situation "${s.id}"`);
    situations.add(s.id);
  }

  // One id namespace for everything in the pack.
  const owners = new Map<string, string>();
  const kinds = new Map<string, LessonItemKind | "unit" | "lesson" | "dialogue" | "placement" | "story" | "verb">();
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
  /** The voice a playable without an explicit `voice` gets: the first one, or its rotated one (pack.json `voiceRotation`). */
  const autoVoice = (key: string) => (rotation ? rotatedVoice(meta.voices, key) : defaultVoice);
  /** An explicit `voice` (validated) always wins; else `autoVoice(key)`. */
  const voiceOf = (voice: string | undefined, where: string, key: string) =>
    voice ? checkVoice(voice, where) : autoVoice(key);
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

  // Glosses: every gloss field carries exactly the pack's gloss languages (docs/content-guide.md,
  // "Gloss languages"). A plain string means Spain Spanish ("es").
  const glossLangs = glossLangsOf(meta);
  if (new Set(glossLangs).size !== glossLangs.length) errors.push(`${src.meta.file}: duplicate language in "glossLangs"`);
  const quoted = (list: readonly string[]) => list.map((l) => `"${l}"`).join(", ");
  const reportGloss = (present: string[], where: string, field: string, plain: boolean) => {
    const missing = glossLangs.filter((l) => !present.includes(l));
    const extra = present.filter((l) => !(glossLangs as readonly string[]).includes(l));
    if (missing.length) errors.push(`${where}: ${field} needs ${quoted(missing)} (pack.json glossLangs: ${quoted(glossLangs)})`);
    if (extra.length) {
      const hint = plain ? ` (plain text means Spain Spanish; write a map like { "${glossLangs[0]}": "…" })` : "";
      errors.push(`${where}: ${field} has ${quoted(extra)}, not in pack.json glossLangs${hint}`);
    }
  };
  /** A gloss field: a string (Spain Spanish) or a per-language map. */
  const checkGloss = (value: GlossText | undefined, where: string, field: string) => {
    if (value === undefined) return;
    reportGloss(typeof value === "string" ? ["es"] : Object.keys(value), where, field, typeof value === "string");
  };
  /** A table cell / placement option: plain strings are shown as written, maps are glosses. */
  const checkGlossMap = (value: string | GlossMap, where: string, field: string) => {
    if (typeof value !== "string") checkGloss(value, where, field);
  };
  /** Language-named siblings: `es` / `ru` / `en`, or `<base>Es` / `<base>Ru`… */
  const checkTranslation = (item: object, where: string, base?: GlossBase) => {
    const key = (l: GlossLang) => (base ? `${base}${glossSuffix(l)}` : l);
    const map = item as Record<string, unknown>;
    const present = GLOSS_LANG_CODES.filter((l) => typeof map[key(l)] === "string");
    reportGloss(present, where, `translation (${GLOSS_LANG_CODES.map(key).join(" / ")})`, false);
  };
  for (const s of meta.situations) checkGloss(s.title, `${src.meta.file}: situation "${s.id}"`, "title");

  // Gramática (docs/content-guide.md, "Grammar reference"): the tenses verbs conjugate.
  const tenseDefs = new Map<string, z.infer<typeof S.GrammarTense>>();
  for (const t of meta.grammar?.tenses ?? []) {
    const where = `${src.meta.file}: grammar tense "${t.id}"`;
    if (tenseDefs.has(t.id)) errors.push(`${src.meta.file}: duplicate grammar tense "${t.id}"`);
    tenseDefs.set(t.id, t);
    checkGloss(t.title, where, "title");
    if (t.speak && t.speak.length !== t.persons.length) {
      errors.push(`${where}: "speak" has ${t.speak.length} entries but "persons" has ${t.persons.length} (one spoken pronoun per person)`);
    }
    for (const p of [...t.persons, ...(t.speak ?? [])]) checkStress(p, where);
  }
  const tenseList = [...tenseDefs.keys()].map((t) => `"${t}"`).join(", ");
  const sameText = (a: string, b: string) => a.trim().toLocaleLowerCase() === b.trim().toLocaleLowerCase();
  /** Grammar card / verb `drills` → runtime drills (audio key `<id>--g<n>`, full sentence spoken). */
  const buildDrills = (id: string, drills: z.infer<typeof S.GrammarDrill>[] | undefined, where: string): GrammarDrill[] | undefined =>
    drills?.map(({ text, ...d }, i) => {
      const at = `${where} drill ${i + 1}`;
      const gaps = text.match(/_+/g) ?? [];
      if (gaps.length !== 1 || gaps[0] !== DRILL_GAP) {
        errors.push(`${at}: "text" must hold the gap "${DRILL_GAP}" exactly once (found ${gaps.length ? gaps.map((g) => `"${g}"`).join(", ") : "none"})`);
      }
      if (d.distractors.some((x) => sameText(x, d.answer))) errors.push(`${at}: the answer "${d.answer}" is also among its distractors`);
      if (new Set(d.distractors.map((x) => x.trim().toLocaleLowerCase())).size !== d.distractors.length) {
        errors.push(`${at}: repeated distractor (needs ≥ 2 distinct ones)`);
      }
      checkTranslation(d, at);
      const gap = text.indexOf(DRILL_GAP);
      const before = gap < 0 ? text : text.slice(0, gap);
      const after = gap < 0 ? "" : text.slice(gap + DRILL_GAP.length);
      for (const t of [before + d.answer + after, ...d.distractors]) checkStress(t, at);
      const key = audioKey(id, `g${i + 1}`);
      return { ...d, text: before + d.answer + after, before, after, audioKey: key, voice: autoVoice(key) };
    });

  const phrases: Phrase[] = [];
  const vocab: Vocab[] = [];
  const qa: QA[] = [];
  const grammar: GrammarCard[] = [];
  const expressions: Expression[] = [];
  const placement: PlacementQuestion[] = [];
  /** Grammar cards' `verb` links, checked once every verb is registered. */
  const cardVerbs: { where: string; verb: string }[] = [];

  const resolveImage = (key: string | undefined) => (key ? src.resolveImage?.(key) : undefined);

  const addVocab = (file: string, v: z.infer<typeof S.Vocab>, level?: Level) => {
    const where = `${file}: vocab "${v.id}"`;
    claim(v.id, "vocab", file);
    checkSituation(v.situation, where);
    checkArticle(v.article, where);
    checkStress(v.word, where);
    checkStress(v.plural, `${where} plural`);
    checkTranslation(v, where);
    checkGloss(v.notes, where, "notes");
    const { image: imageKey, ...rest } = v;
    vocab.push({
      ...rest,
      ...(level ? { level } : {}),
      kind: "vocab",
      text: vocabText(v.word, v.article),
      audioKey: audioKey(v.id),
      voice: voiceOf(v.voice, where, v.id),
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
      checkTranslation(p, where);
      checkGloss(p.literal, where, "literal");
      checkGloss(p.notes, where, "notes");
      checkGloss(p.explanation, where, "explanation");
      phrases.push({ ...p, ...lv, kind: "phrase", audioKey: audioKey(p.id), voice: voiceOf(p.voice, where, p.id) });
    }
    for (const v of f.vocab) addVocab(file, v, level);
    for (const q of f.qa) {
      const where = `${file}: qa "${q.id}"`;
      claim(q.id, "qa", file);
      checkSituation(q.situation, where);
      checkRegister(q.register, where);
      for (const t of [q.question, ...q.accepted.map((r) => r.text), ...q.distractors.map((r) => r.text)]) checkStress(t, where);
      checkTranslation(q, where, "question");
      checkGloss(q.notes, where, "notes");
      q.accepted.forEach((r, i) => checkTranslation(r, `${where} accepted ${i + 1}`));
      q.distractors.forEach((r, i) => checkTranslation(r, `${where} distractor ${i + 1}`));
      const voice = voiceOf(q.voice, where, q.id);
      // Replies sound different from the question; all replies of one Q&A share a voice.
      const replyVoice = rotation ? otherVoice(meta.voices, voice, `${q.id}--r`) : defaultVoice;
      qa.push({
        ...q,
        ...lv,
        kind: "qa",
        text: q.question,
        audioKey: audioKey(q.id, "q"),
        voice,
        accepted: q.accepted.map((r, i) => ({ ...r, audioKey: audioKey(q.id, `a${i + 1}`), voice: replyVoice })),
        distractors: q.distractors.map((r, i) => ({ ...r, audioKey: audioKey(q.id, `d${i + 1}`), voice: replyVoice })),
      });
    }
    for (const g of f.grammar) {
      claim(g.id, "grammar", file);
      const where = `${file}: grammar "${g.id}"`;
      for (const e of g.examples) checkStress(e.text, where);
      checkGloss(g.title, where, "title");
      checkGloss(g.summary, where, "summary");
      g.points.forEach((p, i) => checkGloss(p, where, `points ${i + 1}`));
      g.table?.forEach((row, r) => row.forEach((cell, c) => checkGlossMap(cell, where, `table cell ${r + 1}.${c + 1}`)));
      g.examples.forEach((e, i) => checkTranslation(e, `${where} example ${i + 1}`));
      if (g.verb) cardVerbs.push({ where, verb: g.verb });
      const { drills, ...card } = g;
      const cardVoice = autoVoice(g.id); // a card's examples share one voice
      grammar.push({
        ...card,
        ...lv,
        kind: "grammar",
        examples: g.examples.map((e, i) => ({ ...e, audioKey: audioKey(g.id, `e${i + 1}`), voice: cardVoice })),
        ...(drills ? { drills: buildDrills(g.id, drills, where) } : {}),
      });
    }
    for (const x of f.expressions) {
      const where = `${file}: expression "${x.id}"`;
      claim(x.id, "expression", file);
      checkStress(x.text, where);
      checkTranslation(x, where);
      checkGloss(x.variety, where, "variety");
      checkGloss(x.notes, where, "notes");
      expressions.push({ ...x, ...lv, kind: "expression", audioKey: audioKey(x.id), voice: voiceOf(x.voice, where, x.id) });
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
    for (const l of u.lessons) {
      claim(l.id, "lesson", s.file);
      checkGloss(l.title, `${s.file}: lesson "${l.id}"`, "title");
    }
    checkGloss(u.title, `${s.file}: unit "${u.id}"`, "title");
    checkGloss(u.description, `${s.file}: unit "${u.id}"`, "description");
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
    checkGloss(d.title, where, "title");
    checkGloss(d.description, where, "description");
    rawDialogueUnits.push({ file: s.file, id: d.id, unit: d.unit });
    const turnIds = new Set<string>();
    // voiceRotation: one voice per native speaker name; different speakers get different voices.
    const speakers = new Map<string, { name: string; explicit?: string }>();
    for (const t of d.turns) {
      if (t.speaker !== "native") continue;
      const sp = speakers.get(t.name ?? "") ?? { name: t.name ?? "" };
      if (t.voice && !sp.explicit) sp.explicit = t.voice;
      speakers.set(sp.name, sp);
    }
    const speakerVoice = rotation ? speakerVoices(meta.voices, d.id, [...speakers.values()]) : undefined;
    const turns: Dialogue["turns"] = d.turns.map((t) => {
      if (turnIds.has(t.id)) errors.push(`${where}: duplicate turn id "${t.id}"`);
      turnIds.add(t.id);
      if (t.speaker === "native") {
        checkStress(t.text, `${where} turn "${t.id}"`);
        checkTranslation(t, `${where} turn "${t.id}"`);
        return {
          ...t,
          audioKey: audioKey(d.id, t.id),
          voice: t.voice
            ? checkVoice(t.voice, `${where} turn "${t.id}"`)
            : (speakerVoice?.get(t.name ?? "") ?? defaultVoice),
          avatar: resolveImage(t.name ? d.avatars?.[t.name] : undefined),
        };
      }
      for (const o of t.options) checkStress(o.text, `${where} turn "${t.id}"`);
      checkGloss(t.prompt, `${where} turn "${t.id}"`, "prompt");
      t.options.forEach((o, i) => {
        checkTranslation(o, `${where} turn "${t.id}" option ${i + 1}`);
        checkGloss(o.feedback, `${where} turn "${t.id}" option ${i + 1}`, "feedback");
      });
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
    const voice = voiceOf(st.voice, where, st.id);
    checkStress(st.title, `${where} title`);
    checkTranslation(st, where, "title");
    checkGloss(st.description, where, "description");
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
      checkTranslation(x, `${where} sentence "${x.id}"`);
      const v = x.voice ? checkVoice(x.voice, `${where} sentence "${x.id}"`) : voice;
      return { ...x, audioKey: audioKey(st.id, x.id), voice: v };
    });
    const questions = st.questions.map((q) => {
      local(q.id);
      for (const t of [q.question, ...q.options.map((o) => o.text)]) checkStress(t, `${where} question "${q.id}"`);
      checkTranslation(q, `${where} question "${q.id}"`);
      q.options.forEach((o, i) => checkTranslation(o, `${where} question "${q.id}" option ${i + 1}`));
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
      ...(st.titleEn !== undefined ? { titleEn: st.titleEn } : {}),
      ...(st.titleRu !== undefined ? { titleRu: st.titleRu } : {}),
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

  // Verbs (Gramática): one file each, every tense of pack.json `grammar.tenses` they have.
  const verbs: Verb[] = [];
  const verbOrders = new Map<number, string>();
  for (const s of src.verbs ?? []) {
    const v = parse(S.VerbFile, s, schemaErrors);
    if (!v) continue;
    const where = `${s.file}: verb "${v.id}"`;
    claim(v.id, "verb", s.file);
    if (!v.id.startsWith(VERB_ID_PREFIX)) errors.push(`${where}: id must start with "${VERB_ID_PREFIX}" (${VERB_ID_PREFIX}<slug>)`);
    const clash = verbOrders.get(v.order);
    if (clash) errors.push(`${where}: order ${v.order} already used by verb "${clash}"`);
    verbOrders.set(v.order, v.id);
    checkStress(v.infinitive, where);
    checkTranslation(v, where);
    checkGloss(v.notes, where, "notes");
    const { tenses: rawTenses, drills, ...verb } = v;
    const verbVoice = autoVoice(v.id); // infinitive, forms and examples of a verb share one voice
    if (!meta.grammar) errors.push(`${where}: verbs need pack.json "grammar" (the tenses they conjugate)`);
    else {
      for (const id of Object.keys(rawTenses)) {
        if (!tenseDefs.has(id)) errors.push(`${where}: unknown tense "${id}" (pack.json grammar.tenses: ${tenseList})`);
      }
    }
    if (Object.keys(rawTenses).length === 0) errors.push(`${where}: needs at least one tense`);
    const tenses: VerbTense[] = [];
    for (const def of tenseDefs.values()) {
      const t = rawTenses[def.id];
      if (!t) continue;
      const at = `${where} tense "${def.id}"`;
      if (t.forms.length !== def.persons.length) {
        errors.push(`${at}: ${t.forms.length} form(s), expected ${def.persons.length} (one per pack.json persons: ${def.persons.join(", ")})`);
      }
      const forms = t.forms.map(({ say, ...f }, i) => {
        const fat = `${at} form ${i + 1}`;
        checkStress(f.form, fat);
        checkStress(say, fat);
        checkTranslation(f, fat);
        const pronoun = def.speak?.[i];
        const spoken = say ?? f.form;
        return {
          ...f,
          person: def.persons[i] ?? "",
          text: pronoun ? `${pronoun} ${spoken}` : spoken,
          audioKey: audioKey(v.id, def.id, i + 1),
          voice: verbVoice,
        };
      });
      checkStress(t.example.text, `${at} example`);
      checkTranslation(t.example, `${at} example`);
      checkGloss(t.notes, at, "notes");
      tenses.push({
        id: def.id,
        forms,
        example: { ...t.example, audioKey: audioKey(v.id, def.id, "e"), voice: verbVoice },
        ...(t.notes !== undefined ? { notes: t.notes } : {}),
      });
    }
    verbs.push({
      ...verb,
      kind: "verb",
      text: v.infinitive,
      audioKey: audioKey(v.id),
      voice: verbVoice,
      tenses,
      ...(drills ? { drills: buildDrills(v.id, drills, where) } : {}),
    });
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
  for (const { where, verb } of cardVerbs) {
    const kind = kinds.get(verb);
    if (kind !== "verb") errors.push(`${where}: verb "${verb}" ${kind ? `is a ${kind}, not a verb` : "is not a verb of this pack (verbs/*.json)"}`);
  }
  for (const { file, q } of rawPlacement) {
    const where = `${file}: placement "${q.id}"`;
    if (q.answer >= q.options.length) errors.push(`${where}: answer ${q.answer} is out of range`);
    for (const t of [q.text, ...q.options]) if (typeof t !== "object") checkStress(t, where);
    checkGloss(q.prompt, where, "prompt");
    q.options.forEach((o, i) => checkGlossMap(o, where, `option ${i + 1}`));
    checkLevel(q.level, where);
    for (const l of q.lessons) if (kinds.get(l) !== "lesson") errors.push(`${where}: unknown lesson "${l}"`);
    const { voice, ...rest } = q;
    placement.push({
      ...rest,
      audio: q.text ? { text: q.text, audioKey: audioKey(q.id), voice: voiceOf(voice, where, q.id) } : undefined,
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
    const guide = storyGuide(story.level);
    const misses = (Object.keys(guide) as (keyof typeof guide)[])
      .filter((k) => counts[k] < guide[k][0] || counts[k] > guide[k][1])
      .map((k) => `${counts[k]} ${k} (guideline ${guide[k][0]}–${guide[k][1]} for ${story.level})`);
    if (misses.length) warnings.push(`${where}: ${misses.join(", ")}`);
  }

  units.sort((a, b) => a.order - b.order);
  dialogues.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
  stories.sort((a, b) => a.order - b.order);
  verbs.sort((a, b) => a.order - b.order);

  const pack: Pack = { meta, units, dialogues, stories, phrases, vocab, qa, grammar, expressions, placement, verbs };
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
    verbs: p.verbs.length,
    explanations: p.phrases.filter((x) => x.explanation).length,
    pictures: p.vocab.filter((x) => x.image).length,
  };
}
