/**
 * Language-pack data contract (source JSON files under `content/<lang>/`).
 *
 * These zod schemas describe what content authors write. They are only executed by
 * `scripts/content.ts` (validation + bundling); the app imports the inferred TYPES, never zod at
 * runtime. Runtime (normalised) types with audio keys live in `./types.ts`.
 *
 * See docs/content-guide.md for the human-readable version of this contract.
 */
import { z } from "zod";
import { GLOSS_LANG_CODES } from "./gloss";
import { IMAGE_KEY_PATTERN } from "./keys";

/** Stable id: lowercase ascii, words joined by single "-" or "." (e.g. `tren.biglietto-per`). */
export const ID_PATTERN = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/;

export const Id = z.string().regex(ID_PATTERN, "id must be lowercase a-z0-9 joined by single '-' or '.'");
/** Non-empty text after trimming. */
export const Text = z.string().trim().min(1, "must not be empty");
export const Tags = z.array(Id).default([]);

// ---------------------------------------------------------------------------------------------
// Glosses (docs/content-guide.md, "Gloss languages"; resolver: `glossOf()` in ./gloss.ts)
// ---------------------------------------------------------------------------------------------

/** A gloss language code (`es` = Spain Spanish, `en`, `ru`). */
export const GlossLang = z.enum(GLOSS_LANG_CODES);

/** One text per gloss language (`{ "ru": "…" }`); which languages are required is checked by `content:check`. */
export const GlossMap = z
  .object({ es: Text.optional(), en: Text.optional(), ru: Text.optional() })
  .strict()
  .refine((m) => Object.keys(m).length > 0, "needs at least one gloss language");

/**
 * A learner-facing gloss field: a string (Spain Spanish, the only form before `glossLangs`) or one
 * text per gloss language of the pack.
 */
export const Gloss = z.union([Text, GlossMap]);

/**
 * A table cell: a plain string is shown as written in every gloss language (target-language
 * forms, names); a map is a gloss (one text per gloss language).
 */
export const GlossOrVerbatim = z.union([z.string(), GlossMap]);

/**
 * Translation siblings named after the language: `es` (Spain Spanish), `en`, `ru`. Each is
 * optional here; `content:check` requires exactly the pack's `glossLangs` (default `["es"]`).
 * A new gloss language adds a sibling here and in `GLOSS_LANGUAGES` (./gloss.ts).
 */
const Translation = { es: Text.optional(), en: Text.optional(), ru: Text.optional() };
/** `questionEs` / `questionEn` / `questionRu` (Q&A), same rule as `Translation`. */
const QuestionTranslation = { questionEs: Text.optional(), questionEn: Text.optional(), questionRu: Text.optional() };
/** `titleEs` / `titleEn` / `titleRu` (stories), same rule as `Translation`. */
const TitleTranslation = { titleEs: Text.optional(), titleEn: Text.optional(), titleRu: Text.optional() };

/**
 * Picture key: `fluent:<icon>` (Fluent Emoji Flat icon name) or `custom:<slug>` (drawing in
 * `assets/images/custom/<slug>.svg`). See docs/content-guide.md, "Pictures".
 */
export const ImageKey = z
  .string()
  .regex(IMAGE_KEY_PATTERN, 'image must be "fluent:<icon-name>" or "custom:<slug>" (lowercase a-z0-9 joined by single "-")');

/**
 * Target-language register: tu = informal, lei / vous / vy / u / usted / formal = formal (each pack allows
 * only its own `formalRegister`, checked by `content:check`), neutral = either.
 */
export const Register = z.enum(["tu", "lei", "vous", "vy", "u", "usted", "formal", "neutral"]);

/**
 * Formal register of a pack (`pack.json` `formalRegister`): Italian `lei`, French `vous`, a
 * language whose polite "you" is the plural pronoun romanized "vy", a language whose polite
 * "you" is written "u" (Dutch); `usted` for Spanish (the pronoun shown for `tu` may differ per
 * register, e.g. "vos": `INFORMAL_PRONOUN` in ./register.ts); `formal` for a language
 * without a polite pronoun (polite or formal wording instead).
 */
export const FormalRegister = z.enum(["lei", "vous", "vy", "u", "usted", "formal"]);

/** CEFR level (stories; units, dialogues and placement questions of a pack with `levels`). */
export const Level = z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);

/** Lower-case text (`equivalents` keys and values are compared after lower-casing the answer). */
const LowerText = Text.refine((s) => s === s.toLocaleLowerCase(), "must be lower case");

// ---------------------------------------------------------------------------------------------
// Pack meta: content/<lang>/pack.json
// ---------------------------------------------------------------------------------------------

export const Situation = z.object({
  id: Id,
  /** Label shown in the phrasebook / filters (a gloss). */
  title: Gloss,
  /** Single emoji used as a visual hint. */
  emoji: Text.optional(),
});

/** One character (a single UTF-16 code unit, e.g. a combining mark or a letter). */
const Char = z.string().length(1, "must be exactly one character");
/** Non-empty string of letters, each counted on its own ("aeiou"). */
const Letters = z.string().min(1);

/**
 * Written stress marks (`pack.json` `stress`): a combining `mark` written right after the stressed
 * vowel of every target-language word with two or more `vowels`; never in one-vowel words, never
 * in words that hold a `selfStressed` letter (always stressed by itself). `content:check` enforces
 * it; the mark is stripped before TTS and ignored when matching answers.
 */
export const StressRule = z.object({
  mark: Char,
  /** Lower-case vowels of the script (upper-case forms are derived). */
  vowels: Letters,
  /** Lower-case vowels that carry their own stress and are never marked. */
  selfStressed: Letters.optional(),
});

/** Lower-case source letters (one or more characters) → Latin spelling. */
const LetterMap = z.record(z.string().min(1), z.string());

/**
 * Latin transliteration of a non-Latin script (`pack.json` `romanization`), generated by
 * `romanize()` (no per-item field): greedy per-letter `map` (longest key first, upper case kept on
 * the first Latin letter), `wordStart` / `afterVowel` variants (after a `stress` vowel or a letter
 * romanized without Latin letters), the stress mark (and a `selfStressed` letter in a word of
 * two or more vowels) turned into an acute on the romanized vowel when `stressAccent`.
 * `alternatives`: canonical Latin spelling → other spellings accepted when typing.
 */
export const Romanization = z.object({
  map: LetterMap,
  wordStart: LetterMap.optional(),
  afterVowel: LetterMap.optional(),
  stressAccent: z.boolean().optional(),
  alternatives: z.record(z.string().min(1), z.array(z.string().min(1)).min(1)).optional(),
});

export const PackMeta = z.object({
  /**
   * The default pack (exactly one pack sets `"default": true`): the app's fallback language and
   * the first one in pickers.
   */
  default: z.literal(true).optional(),
  /** ISO 639-1 code, equals the folder name (`it`). */
  lang: z.string().regex(/^[a-z]{2,3}$/),
  /** Name of the language in Spanish ("Italiano", "Francés"). */
  name: Text,
  /** Name of the language in itself ("Italiano", "Français"). */
  nativeName: Text,
  /** BCP-47 locale for speechSynthesis and speech recognition ("it-IT"). */
  speechLocale: z.string().regex(/^[a-z]{2,3}-[A-Z]{2}$/),
  /** Neural voices available for pre-generated mp3 (edge-tts names). First = default. */
  voices: z.array(Text).min(1),
  /**
   * Numbers written out ("40" → "quaranta"): speech recognition often returns digits, so spoken
   * answers are compared with the digits replaced by these words.
   */
  numberWords: z.record(z.string().regex(/^\d+$/), Text).optional(),
  /** Situations used by phrases, units and dialogues (phrasebook sections), in display order. */
  situations: z.array(Situation).min(1),
  /** Flag emoji shown by the language picker ("🇮🇹"). */
  emoji: Text.optional(),
  /** The only formal register this pack's items may use (besides `tu` and `neutral`). */
  formalRegister: FormalRegister,
  /**
   * Languages the pack's glosses (translations, notes, grammar cards…) are written in, in order;
   * the first is the learner's default. Omitted = `["es"]` (Spain Spanish). Every gloss field
   * carries exactly these languages (`content:check`).
   */
  glossLangs: z.array(GlossLang).min(1).optional(),
  /**
   * Definite articles allowed in vocab `article`, as written ("il", "l'", …). Omitted for a
   * language without articles: vocab then has no `article`.
   */
  articles: z.array(Text).min(1).optional(),
  /**
   * CEFR levels of a pack split by level, in order (`["A2", "B1"]`). With `levels`, every unit,
   * dialogue, story and placement question has a `level` from this list; without it (one course),
   * units, dialogues and placement questions have no `level`.
   */
  levels: z.array(Level).min(1).optional(),
  /**
   * Equivalent spellings for answer and speech matching, lower case: contracted → full form
   * (`"i'm": "i am"`). Applied to both sides before comparing.
   */
  equivalents: z.record(LowerText, LowerText).optional(),
  /** Written stress marks rule (see `StressRule`). */
  stress: StressRule.optional(),
  /** Latin line under target text and Latin typed answers (see `Romanization`). */
  romanization: Romanization.optional(),
  /**
   * Lower-case letters treated as equal when matching answers and scoring speech, letter → the
   * letter it counts as. Applied to both sides (`foldText()`).
   */
  fold: z.record(Char, Char).optional(),
});

// ---------------------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------------------

export const Phrase = z.object({
  id: Id,
  /** Target-language text, as spoken ("Vorrei un biglietto per Catania."). */
  text: Text,
  /** Natural translation: `es` = Spain Spanish, `ru` / `en` in a pack with those `glossLangs`. */
  ...Translation,
  /** Word-for-word translation when it helps ("Querría un billete para Catania"). */
  literal: Gloss.optional(),
  /** Short usage note. */
  notes: Gloss.optional(),
  /**
   * Spanish ("tú"), 1–2 short lines: when to use it + one pronunciation tip
   * ("Se lo dices al revisor cuando…; «gli» suena como una «ll» suave."). Shown on game cards.
   */
  explanation: Gloss.optional(),
  register: Register,
  /** Situation id from pack.json. */
  situation: Id,
  tags: Tags,
  /** Voice from pack.json `voices`; defaults to the first one. */
  voice: Text.optional(),
});

/** m, f, n (neuter), mf (either), pl (plural-only noun). */
export const Gender = z.enum(["m", "f", "n", "mf", "pl"]);

export const Vocab = z.object({
  id: Id,
  /** Bare word without article ("biglietto"). */
  word: Text,
  /** Definite article as written before the word; must be one of pack.json `articles` ("il", "l'", "le"…). */
  article: Text.optional(),
  gender: Gender.optional(),
  /** Plural form when irregular or useful. */
  plural: Text.optional(),
  /** Translation (`es` / `ru` / `en`), with article when it is a noun ("el billete"). */
  ...Translation,
  notes: Gloss.optional(),
  /** Optional phrase id that uses the word. */
  example: Id.optional(),
  situation: Id.optional(),
  tags: Tags,
  voice: Text.optional(),
  /** Picture key (`fluent:<icon>` | `custom:<slug>`), only for drawable words. */
  image: ImageKey.optional(),
});

export const Reply = z.object({
  /** Target-language reply. */
  text: Text,
  /** Translation (`es` / `ru` / `en`). */
  ...Translation,
});

/** Q&A pair for "answer" exercises: hear a typical question, pick or say a good reply. */
export const QA = z.object({
  id: Id,
  /** What the native speaker says/asks ("Di dove sei?"). */
  question: Text,
  /** Translation of the question: `questionEs` (Spain Spanish) / `questionRu` / `questionEn`. */
  ...QuestionTranslation,
  /** Good replies. The first one is the model answer. */
  accepted: z.array(Reply).min(1),
  /** Plausible but wrong replies (≥ 2 so a multiple-choice has 3+ options). */
  distractors: z.array(Reply).min(2),
  register: Register,
  situation: Id,
  notes: Gloss.optional(),
  tags: Tags,
  /** Voice for the question (the native speaker). */
  voice: Text.optional(),
});

export const GrammarCard = z.object({
  id: Id,
  /** Title ("Tú y Lei"). */
  title: Gloss,
  /** One or two sentences: the rule, practical and short. */
  summary: Gloss,
  /** Extra bullet points. */
  points: z.array(Gloss).default([]),
  /**
   * Optional table, e.g. a conjugation: rows of cells; first row is the header. A plain string
   * cell is shown as written; a map cell is a gloss.
   */
  table: z.array(z.array(GlossOrVerbatim)).optional(),
  /** Target-language examples (playable). */
  examples: z.array(Reply).default([]),
  tags: Tags,
});

/** Recognition-only expression (e.g. Sicilian): the learner should understand it, not produce it. */
export const Expression = z.object({
  id: Id,
  text: Text,
  ...Translation,
  /** Variety or dialect ("Siciliano"). */
  variety: Gloss,
  /** Standard-language equivalent ("Andiamo!" for "Amunì!"). */
  standard: Text.optional(),
  notes: Gloss.optional(),
  tags: Tags,
  voice: Text.optional(),
});

/** Kinds of item a lesson can reference in `items`. */
export const LESSON_ITEM_KINDS = ["phrase", "vocab", "qa", "grammar", "expression"] as const;

export const Lesson = z.object({
  id: Id,
  title: Gloss,
  /** Ids of phrases / vocab / qa / grammar cards / expressions, in teaching order. */
  items: z.array(Id).min(1, "a lesson needs at least one item"),
});

/** Arrays of items any unit or extras file may define. */
const ItemArrays = {
  phrases: z.array(Phrase).default([]),
  vocab: z.array(Vocab).default([]),
  qa: z.array(QA).default([]),
  grammar: z.array(GrammarCard).default([]),
  expressions: z.array(Expression).default([]),
};

// ---------------------------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------------------------

/** content/<lang>/units/*.json — one unit per file, self-contained with its items. */
export const UnitFile = z.object({
  id: Id,
  /** Sort key; ranges in docs/content-guide.md (10–19 survival, 20–29 getting around...). */
  order: z.number().int().min(0),
  title: Gloss,
  /** One-line description shown on the path. */
  description: Gloss.optional(),
  emoji: Text.optional(),
  situation: Id,
  /** CEFR level: required when pack.json has `levels` (one of them), not allowed otherwise. */
  level: Level.optional(),
  lessons: z.array(Lesson).min(1, "a unit needs at least one lesson"),
  ...ItemArrays,
});

export const PlacementQuestion = z.object({
  id: Id,
  /** Instruction/question shown to the learner ("¿Qué significa?"). */
  prompt: Gloss,
  /** Optional target-language text shown and/or played. */
  text: Text.optional(),
  /** Answer options (at least 2): plain = shown as written (target language), map = a gloss. */
  options: z.array(z.union([Text, GlossMap])).min(2),
  /** Index of the correct option. */
  answer: z.number().int().min(0),
  /** Lesson ids marked as done when the learner answers correctly. */
  lessons: z.array(Id).min(1),
  voice: Text.optional(),
  /** CEFR level: required when pack.json has `levels` (one of them), not allowed otherwise. */
  level: Level.optional(),
});

/** content/<lang>/extras/*.json — items not owned by a unit (phrasebook-only, Sicilian, placement). */
export const ExtrasFile = z.object({
  ...ItemArrays,
  placement: z.array(PlacementQuestion).default([]),
});

export const NativeTurn = z.object({
  id: Id,
  speaker: z.literal("native"),
  /** Optional character name shown above the bubble ("Bigliettaio"). */
  name: Text.optional(),
  text: Text,
  ...Translation,
  voice: Text.optional(),
});

export const LearnerOption = z.object({
  text: Text,
  ...Translation,
  /** correct = best answer; acceptable = works but not ideal; wrong = mistake. */
  verdict: z.enum(["correct", "acceptable", "wrong"]),
  /** Feedback shown after choosing it. */
  feedback: Gloss,
});

export const LearnerTurn = z.object({
  id: Id,
  speaker: z.literal("learner"),
  /** Hint of what the learner wants to say ("Pide un billete a Catania"). */
  prompt: Gloss,
  options: z.array(LearnerOption).min(2),
});

/** content/<lang>/dialogues/*.json — one dialogue per file. */
export const DialogueFile = z.object({
  id: Id,
  title: Gloss,
  description: Gloss.optional(),
  situation: Id,
  /** Optional unit id: the dialogue belongs with that unit on the path. */
  unit: Id.optional(),
  /** Sort key inside the dialogues list (defaults to 0, ties sorted by id). */
  order: z.number().int().min(0).default(0),
  register: Register,
  /** CEFR level: required when pack.json has `levels` (one of them), not allowed otherwise. */
  level: Level.optional(),
  /**
   * Speaker avatars: native turn `name` → picture key (`fluent:man-cook`). Every key must be the
   * `name` of a native turn of this dialogue. The learner has no avatar.
   */
  avatars: z.record(z.string().min(1), ImageKey).optional(),
  turns: z.array(z.discriminatedUnion("speaker", [NativeTurn, LearnerTurn])).min(2),
});

// ---------------------------------------------------------------------------------------------
// Stories: content/<lang>/stories/*.json
// ---------------------------------------------------------------------------------------------

export const StorySentence = z.object({
  /** Local id, unique inside the story: `s1`, `s2`… */
  id: Id,
  /** Target-language sentence, as spoken. */
  text: Text,
  /** Natural translation (shown on demand): `es` = Spain Spanish, `ru` / `en`. */
  ...Translation,
  /** Voice for this sentence (e.g. a character's line); defaults to the story voice. */
  voice: Text.optional(),
});

/**
 * A key word is either the id of an existing vocab / phrase / expression of the pack, or a new
 * vocab item defined inline (its id must start with `story-`). Inline items become normal pack
 * vocab: same id namespace, reusable from other stories by id, SRS works by id.
 */
export const StoryKeyword = z.union([Id, Vocab]);

export const StoryQuestion = z.object({
  /** Local id, unique inside the story: `q1`, `q2`… */
  id: Id,
  /** Target-language comprehension question ("Dove va Hernán?"). */
  question: Text,
  /** Translation of the question (`es` / `ru` / `en`). */
  ...Translation,
  /** Target-language answers `{ text, es }` (≥ 3), exactly one right. */
  options: z.array(Reply).min(3),
  /** 0-based index of the right option. */
  correct: z.number().int().min(0),
});

export const StoryGap = z.object({
  /** Local id, unique inside the story: `g1`, `g2`… */
  id: Id,
  /** Id of the sentence of this story that holds the gap. */
  sentence: Id,
  /** Key word id (one of the story `keywords`) that fills the gap. */
  answer: Id,
  /**
   * Exact text blanked in the sentence (case-insensitive, first occurrence). Defaults to the key
   * word's bare `word` (vocab) or `text` (phrase / expression). Set it when the sentence uses
   * another form ("biglietti", "stazione" without article).
   */
  gap: Text.optional(),
  /** Wrong chips in the same form as the gap (≥ 2, all different from it). */
  distractors: z.array(Text).min(2),
});

/** content/<lang>/stories/*.json — one story per file. */
export const StoryFile = z.object({
  id: Id,
  /** Trip order (1, 2, 3…), unique among stories. */
  order: z.number().int().min(0),
  /** Target-language title ("Arrivo a Palermo"). */
  title: Text,
  /** Translated title: `titleEs` ("Llegada a Palermo") / `titleRu` / `titleEn`. */
  ...TitleTranslation,
  /** One-line description shown in the list. */
  description: Gloss.optional(),
  emoji: Text.optional(),
  situation: Id,
  /** CEFR level; with pack.json `levels`, one of them. */
  level: Level,
  /** Narrator voice (sentences, questions, options); defaults to the first pack voice. */
  voice: Text.optional(),
  sentences: z.array(StorySentence).min(1),
  keywords: z.array(StoryKeyword).min(1),
  questions: z.array(StoryQuestion).default([]),
  gaps: z.array(StoryGap).default([]),
});

export type PackMetaInput = z.infer<typeof PackMeta>;
export type UnitFileInput = z.infer<typeof UnitFile>;
export type ExtrasFileInput = z.infer<typeof ExtrasFile>;
export type DialogueFileInput = z.infer<typeof DialogueFile>;
export type StoryFileInput = z.infer<typeof StoryFile>;
