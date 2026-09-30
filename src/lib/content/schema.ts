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

/** Stable id: lowercase ascii, words joined by single "-" or "." (e.g. `tren.biglietto-per`). */
export const ID_PATTERN = /^[a-z0-9]+(?:[-.][a-z0-9]+)*$/;

export const Id = z.string().regex(ID_PATTERN, "id must be lowercase a-z0-9 joined by single '-' or '.'");
/** Non-empty text after trimming. */
export const Text = z.string().trim().min(1, "must not be empty");
export const Tags = z.array(Id).default([]);

/** Italian (target-language) register: tu = informal, lei = formal, neutral = either. */
export const Register = z.enum(["tu", "lei", "neutral"]);

// ---------------------------------------------------------------------------------------------
// Pack meta: content/<lang>/pack.json
// ---------------------------------------------------------------------------------------------

export const Situation = z.object({
  id: Id,
  /** Spanish label shown in the phrasebook / filters. */
  title: Text,
  /** Single emoji used as a visual hint. */
  emoji: Text.optional(),
});

export const PackMeta = z.object({
  /** ISO 639-1 code, equals the folder name (`it`). */
  lang: z.string().regex(/^[a-z]{2,3}$/),
  /** Name of the language in Spanish ("Italiano"). */
  name: Text,
  /** Name of the language in itself ("Italiano"). */
  nativeName: Text,
  /** BCP-47 locale for speechSynthesis and speech recognition ("it-IT"). */
  speechLocale: z.string().regex(/^[a-z]{2,3}-[A-Z]{2}$/),
  /** Neural voices available for pre-generated mp3 (edge-tts names). First = default. */
  voices: z.array(Text).min(1),
  /** Situations used by phrases, units and dialogues (phrasebook sections), in display order. */
  situations: z.array(Situation).min(1),
});

// ---------------------------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------------------------

export const Phrase = z.object({
  id: Id,
  /** Target-language text, as spoken ("Vorrei un biglietto per Catania."). */
  text: Text,
  /** Natural Spain-Spanish translation. */
  es: Text,
  /** Word-for-word translation when it helps ("Querría un billete para Catania"). */
  literal: Text.optional(),
  /** Short usage note in Spanish. */
  notes: Text.optional(),
  register: Register,
  /** Situation id from pack.json. */
  situation: Id,
  tags: Tags,
  /** Voice from pack.json `voices`; defaults to the first one. */
  voice: Text.optional(),
});

export const Gender = z.enum(["m", "f", "mf"]);

export const Vocab = z.object({
  id: Id,
  /** Bare word without article ("biglietto"). */
  word: Text,
  /** Definite article as it is written before the word: "il", "lo", "la", "l'", "i", "gli", "le". */
  article: Text.optional(),
  gender: Gender.optional(),
  /** Plural form when irregular or useful. */
  plural: Text.optional(),
  /** Spanish translation, with article when it is a noun ("el billete"). */
  es: Text,
  notes: Text.optional(),
  /** Optional phrase id that uses the word. */
  example: Id.optional(),
  situation: Id.optional(),
  tags: Tags,
  voice: Text.optional(),
});

export const Reply = z.object({
  /** Target-language reply. */
  text: Text,
  /** Spanish translation. */
  es: Text,
});

/** Q&A pair for "answer" exercises: hear a typical question, pick or say a good reply. */
export const QA = z.object({
  id: Id,
  /** What the Italian says/asks ("Di dove sei?"). */
  question: Text,
  /** Spanish translation of the question. */
  questionEs: Text,
  /** Good replies. The first one is the model answer. */
  accepted: z.array(Reply).min(1),
  /** Plausible but wrong replies (≥ 2 so a multiple-choice has 3+ options). */
  distractors: z.array(Reply).min(2),
  register: Register,
  situation: Id,
  notes: Text.optional(),
  tags: Tags,
  /** Voice for the question (the Italian speaker). */
  voice: Text.optional(),
});

export const GrammarCard = z.object({
  id: Id,
  /** Spanish title ("Tú y Lei"). */
  title: Text,
  /** One or two sentences in Spanish: the rule, practical and short. */
  summary: Text,
  /** Extra bullet points in Spanish. */
  points: z.array(Text).default([]),
  /** Optional table, e.g. a conjugation: rows of cells; first row is the header. */
  table: z.array(z.array(z.string())).optional(),
  /** Target-language examples (playable). */
  examples: z.array(Reply).default([]),
  tags: Tags,
});

/** Recognition-only expression (e.g. Sicilian): the learner should understand it, not produce it. */
export const Expression = z.object({
  id: Id,
  text: Text,
  es: Text,
  /** Variety or dialect in Spanish ("Siciliano"). */
  variety: Text,
  /** Standard-language equivalent ("Andiamo!" for "Amunì!"). */
  standard: Text.optional(),
  notes: Text.optional(),
  tags: Tags,
  voice: Text.optional(),
});

/** Kinds of item a lesson can reference in `items`. */
export const LESSON_ITEM_KINDS = ["phrase", "vocab", "qa", "grammar", "expression"] as const;

export const Lesson = z.object({
  id: Id,
  title: Text,
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
  title: Text,
  /** One-line Spanish description shown on the path. */
  description: Text.optional(),
  emoji: Text.optional(),
  situation: Id,
  lessons: z.array(Lesson).min(1, "a unit needs at least one lesson"),
  ...ItemArrays,
});

export const PlacementQuestion = z.object({
  id: Id,
  /** Spanish instruction/question shown to the learner ("¿Qué significa?"). */
  prompt: Text,
  /** Optional target-language text shown and/or played. */
  text: Text.optional(),
  /** Answer options (at least 2). */
  options: z.array(Text).min(2),
  /** Index of the correct option. */
  answer: z.number().int().min(0),
  /** Lesson ids marked as done when the learner answers correctly. */
  lessons: z.array(Id).min(1),
  voice: Text.optional(),
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
  es: Text,
  voice: Text.optional(),
});

export const LearnerOption = z.object({
  text: Text,
  es: Text,
  /** correct = best answer; acceptable = works but not ideal; wrong = mistake. */
  verdict: z.enum(["correct", "acceptable", "wrong"]),
  /** Spanish feedback shown after choosing it. */
  feedback: Text,
});

export const LearnerTurn = z.object({
  id: Id,
  speaker: z.literal("learner"),
  /** Spanish hint of what the learner wants to say ("Pide un billete a Catania"). */
  prompt: Text,
  options: z.array(LearnerOption).min(2),
});

/** content/<lang>/dialogues/*.json — one dialogue per file. */
export const DialogueFile = z.object({
  id: Id,
  title: Text,
  description: Text.optional(),
  situation: Id,
  /** Optional unit id: the dialogue belongs with that unit on the path. */
  unit: Id.optional(),
  /** Sort key inside the dialogues list (defaults to 0, ties sorted by id). */
  order: z.number().int().min(0).default(0),
  register: Register,
  turns: z.array(z.discriminatedUnion("speaker", [NativeTurn, LearnerTurn])).min(2),
});

export type PackMetaInput = z.infer<typeof PackMeta>;
export type UnitFileInput = z.infer<typeof UnitFile>;
export type ExtrasFileInput = z.infer<typeof ExtrasFile>;
export type DialogueFileInput = z.infer<typeof DialogueFile>;
