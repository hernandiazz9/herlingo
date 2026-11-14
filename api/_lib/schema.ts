/**
 * Prepárate wire schemas (zod), server only: the pack, the quick route, the Modo deporte episode, the
 * learner context, every request body, the interview and Mi entrevista's deck. The only definition
 * of the pack, route, episode and deck schemas; docs/coach.md, docs/sport.md and
 * docs/mock-interview.md mirror them for the client, which gets plain TypeScript types (src/ never
 * imports zod).
 */
import { z } from "zod";

export const LIMITS = {
  description: 500,
  instruction: 200,
  ttsText: 300,
  about: 1000,
  refinementsPerPack: 3,
  interviewTurns: 10,
} as const;

/**
 * Item counts of the generated pack and the assessment. Structured outputs do not enforce a
 * maximum, so the counts are also in the prompts and the schema descriptions, and normalize.ts
 * trims an overflow to these limits before the zod check.
 */
export const PACK_ARRAY_LIMITS = {
  guide: 7,
  keyPhrases: 12,
  options: 3,
  turns: { min: 6, max: 10 },
} as const;
export const ASSESSMENT_ARRAY_LIMITS = { strengths: 8, weakPoints: 8, facts: 10 } as const;
/** Item counts of a quick route (Modo rápido); trimmed like the pack's by normalize.ts. */
export const ROUTE_ARRAY_LIMITS = {
  turns: { min: 4, max: 10 },
  alts: 3,
  words: 4,
} as const;
const P = PACK_ARRAY_LIMITS;
const A = ASSESSMENT_ARRAY_LIMITS;
const R = ROUTE_ARRAY_LIMITS;

const es = z.string().min(1).max(400);
const line = z.string().min(1).max(300);

// ---- Pack: the part Claude writes (structured output) ----

export const Verdict = z.enum(["correct", "acceptable", "wrong"]);

export const GeneratedOption = z.object({
  text: line,
  es,
  verdict: Verdict,
  feedback: es,
});

export const GeneratedNativeTurn = z.object({
  speaker: z.literal("native"),
  name: z.string().max(40).optional(),
  text: line,
  es,
});

export const GeneratedLearnerTurn = z.object({
  speaker: z.literal("learner"),
  prompt: es,
  options: z
    .array(GeneratedOption)
    .min(2)
    .max(P.options)
    .describe(`2 or ${P.options} options, exactly one "correct"; never more than ${P.options}.`),
});

type GeneratedTurn = z.infer<typeof GeneratedNativeTurn> | z.infer<typeof GeneratedLearnerTurn>;

/**
 * What the counts cannot say: speakers alternate (never two native or two learner turns in a row)
 * and every learner turn has exactly one "correct" option (the player marks that one as the answer).
 */
function checkTurns(turns: GeneratedTurn[], ctx: z.RefinementCtx): void {
  turns.forEach((turn, i) => {
    if (i > 0 && turns[i - 1].speaker === turn.speaker) {
      ctx.addIssue({ code: "custom", path: [i, "speaker"], message: `two ${turn.speaker} turns in a row` });
    }
    if (turn.speaker === "learner") {
      const correct = turn.options.filter((o) => o.verdict === "correct").length;
      if (correct !== 1) {
        ctx.addIssue({ code: "custom", path: [i, "options"], message: `${correct} correct options, expected 1` });
      }
    }
  });
}

/** Only the generated pack is checked: packs already on the device are not rejected on refine. */
export const GeneratedPack = z.object({
  title: z.string().min(1).max(80),
  register: z.enum(["formal", "informal"]),
  guide: z
    .array(z.object({ es }))
    .min(3)
    .max(P.guide)
    .describe(`4 to 6 steps; never more than ${P.guide}.`),
  keyPhrases: z
    .array(z.object({ text: line, es, note: z.string().max(200).optional() }))
    .min(8)
    .max(P.keyPhrases)
    .describe(`8 to 10 phrases; never more than ${P.keyPhrases}.`),
  dialogue: z.object({
    title: z.string().min(1).max(80),
    turns: z
      .array(z.discriminatedUnion("speaker", [GeneratedNativeTurn, GeneratedLearnerTurn]))
      .min(P.turns.min)
      .max(P.turns.max)
      .superRefine(checkTurns)
      .describe(
        `7 or 9 entries in total (each native line and each learner turn is one entry), alternating; never fewer than ${P.turns.min} or more than ${P.turns.max}.`,
      ),
  }),
});
export type GeneratedPack = z.infer<typeof GeneratedPack>;

// ---- Pack: what the server returns and the device stores ----

export const NativeTurn = GeneratedNativeTurn.extend({ id: z.string().min(1) });
export const LearnerTurn = GeneratedLearnerTurn.extend({ id: z.string().min(1) });

export const Pack = GeneratedPack.extend({
  id: z.string().min(1).max(64),
  createdAt: z.string().min(1),
  lang: z.string().min(2).max(10),
  description: z.string().min(1).max(LIMITS.description),
  /** Voices for the coach TTS: native turns and key phrases use `native`, learner options `learner`. */
  voices: z.object({ native: z.string().min(1), learner: z.string().min(1) }),
  dialogue: z.object({
    title: z.string().min(1).max(80),
    turns: z.array(z.discriminatedUnion("speaker", [NativeTurn, LearnerTurn])).min(P.turns.min).max(P.turns.max),
  }),
  refinements: z.number().int().min(0),
});
export type Pack = z.infer<typeof Pack>;

// ---- Quick route (Modo rápido): the part Claude writes (structured output) ----

/** A target-language line and its Spain Spanish translation (an alternative or a key word). */
export const RouteLine = z.object({ text: line, es });

export const GeneratedRouteTurn = z.object({
  speaker: z.enum(["native", "learner"]),
  /** The main line, in the target language, and its translation. */
  text: line,
  es,
  alts: z
    .array(RouteLine)
    .max(R.alts)
    .describe(`Usually 2 or 3 other realistic lines for this point; never more than ${R.alts}.`),
  words: z
    .array(RouteLine)
    .max(R.words)
    .describe(`2 to 4 key words or short chunks of this turn; never more than ${R.words}.`),
});
type GeneratedRouteTurn = z.infer<typeof GeneratedRouteTurn>;

/** What the counts cannot say: the learner opens, and speakers alternate (never two in a row). */
function checkRouteTurns(turns: GeneratedRouteTurn[], ctx: z.RefinementCtx): void {
  if (turns.length && turns[0].speaker !== "learner") {
    ctx.addIssue({ code: "custom", path: [0, "speaker"], message: "the learner must open the route" });
  }
  turns.forEach((turn, i) => {
    if (i > 0 && turns[i - 1].speaker === turn.speaker) {
      ctx.addIssue({ code: "custom", path: [i, "speaker"], message: `two ${turn.speaker} turns in a row` });
    }
  });
}

export const GeneratedRoute = z.object({
  title: z.string().min(1).max(80).describe("A few Spanish words, at most 60 characters."),
  register: z.enum(["formal", "informal"]),
  turns: z
    .array(GeneratedRouteTurn)
    .min(R.turns.min)
    .max(R.turns.max)
    .superRefine(checkRouteTurns)
    .describe(
      `6 to 8 entries (each line is one entry), alternating learner and native, the learner first; never fewer than ${R.turns.min} or more than ${R.turns.max}.`,
    ),
});
export type GeneratedRoute = z.infer<typeof GeneratedRoute>;

// ---- Quick route: what the server returns and the device stores ----

export const RouteTurn = GeneratedRouteTurn.extend({ id: z.string().min(1) });

export const Route = GeneratedRoute.extend({
  id: z.string().min(1).max(64),
  createdAt: z.string().min(1),
  lang: z.string().min(2).max(10),
  description: z.string().min(1).max(LIMITS.description),
  /** Voices for the coach TTS: native turns, their alts and every turn's words use `native`; learner turns and their alts `learner`. */
  voices: z.object({ native: z.string().min(1), learner: z.string().min(1) }),
  turns: z.array(RouteTurn).min(R.turns.min).max(R.turns.max).superRefine(checkRouteTurns),
});
export type Route = z.infer<typeof Route>;

// ---- Modo deporte episode (docs/sport.md): the part Claude writes (structured output) ----

/**
 * Longest text per field of an episode. Every one is spoken as one `/api/coach/tts/` line, so
 * none goes over `LIMITS.ttsText` (300); the prompt asks for much less.
 */
export const EPISODE_TEXT_LIMITS = {
  title: 60,
  intro: 300,
  partTitle: 80,
  stepIntro: 200,
  tip: 200,
  cue: 120,
  text: LIMITS.ttsText,
  es: LIMITS.ttsText,
} as const;
const T = EPISODE_TEXT_LIMITS;

/** `steps` = total across parts. Trimmed like the pack's by normalize.ts; empty parts are dropped. */
export const EPISODE_ARRAY_LIMITS = {
  parts: { min: 2, max: 6 },
  steps: { min: 6, max: 20 },
  variants: 2,
} as const;
const E = EPISODE_ARRAY_LIMITS;

/** A target-language line (`text`) and its Spain Spanish meaning (`es`), both spoken. */
export const EpisodeLine = z.object({
  text: z.string().min(1).max(T.text),
  es: z.string().min(1).max(T.es),
});

export const EpisodeVariant = EpisodeLine.extend({
  cue: z.string().min(1).max(T.cue).describe('A few Spanish words the narrator says before it, ending with a colon ("O también:").'),
});

export const EpisodeStep = z.object({
  speaker: z.enum(["learner", "native"]),
  intro: z.string().min(1).max(T.stepIntro),
  line: EpisodeLine,
  variants: z
    .array(EpisodeVariant)
    .max(E.variants)
    .describe(`0 to ${E.variants} other ways to say it; never more than ${E.variants}.`),
  tip: z.string().max(T.tip).optional(),
});

export const EpisodePart = z.object({
  title: z.string().min(1).max(T.partTitle),
  steps: z.array(EpisodeStep).min(1).describe("2 to 5 steps, in the order they happen."),
});
type EpisodePart = z.infer<typeof EpisodePart>;

/** What the per-part counts cannot say: the number of steps across all parts. */
function checkEpisodeSteps(parts: EpisodePart[], ctx: z.RefinementCtx): void {
  const total = parts.reduce((sum, part) => sum + part.steps.length, 0);
  if (total < E.steps.min || total > E.steps.max) {
    ctx.addIssue({ code: "custom", message: `${total} steps in total, expected ${E.steps.min} to ${E.steps.max}` });
  }
}

const episodeParts = z
  .array(EpisodePart)
  .min(E.parts.min)
  .max(E.parts.max)
  .superRefine(checkEpisodeSteps)
  .describe(
    `3 to 5 parts in the order things happen, never fewer than ${E.parts.min} or more than ${E.parts.max}; 12 to 16 steps in total across all parts, never fewer than ${E.steps.min} or more than ${E.steps.max}.`,
  );

export const GeneratedEpisode = z.object({
  title: z.string().min(1).max(T.title).describe("A few Spanish words, at most 50 characters."),
  register: z.enum(["formal", "informal"]),
  intro: z.string().min(1).max(T.intro),
  parts: episodeParts,
});
export type GeneratedEpisode = z.infer<typeof GeneratedEpisode>;

// ---- Modo deporte episode: what the server returns and the device stores (`StoredEpisode`) ----

export const Episode = GeneratedEpisode.extend({
  id: z.string().min(1).max(64),
  source: z.literal("ai"),
  createdAt: z.string().min(1),
  lang: z.string().min(2).max(10),
  description: z.string().min(1).max(LIMITS.description),
  /** Voices for the coach TTS, like routes: native lines and their variants use `native`, learner ones `learner`. */
  voices: z.object({ native: z.string().min(1), learner: z.string().min(1) }),
});
export type Episode = z.infer<typeof Episode>;

// ---- Learner context (built on the device) ----

export const Level = z.enum(["A0", "A1", "A2", "B1", "B2", "C1", "C2"]);

export const Assessment = z.object({
  level: Level,
  summary: z.string().min(1).max(600),
  strengths: z.array(z.string().max(200)).max(A.strengths).describe(`2 to 4 items; never more than ${A.strengths}.`),
  weakPoints: z.array(z.string().max(200)).max(A.weakPoints).describe(`2 to 4 items; never more than ${A.weakPoints}.`),
  facts: z.array(z.string().max(200)).max(A.facts).describe(`Up to 8 items; never more than ${A.facts}.`),
});
export type Assessment = z.infer<typeof Assessment>;

export const LearnerProfile = z.object({
  progress: z
    .object({
      lessonsDone: z.number().int().min(0),
      lessonsTotal: z.number().int().min(0),
      wordsLearned: z.number().int().min(0),
      xp: z.number().int().min(0),
      placement: z.string().max(200).nullable().optional(),
    })
    .optional(),
  assessment: Assessment.extend({ date: z.string().max(40).optional() }).optional(),
  about: z.string().max(LIMITS.about).optional(),
});
export type LearnerProfile = z.infer<typeof LearnerProfile>;

// ---- Requests ----

const lang = z.string().min(2).max(10);

export const PackRequest = z.object({
  lang,
  description: z.string().trim().min(1).max(LIMITS.description),
  profile: LearnerProfile.default({}),
  refine: z
    .object({
      packId: z.string().min(1).max(64),
      /** Empty = "Generar otra vez" (a new version of the same situation). */
      instruction: z.string().trim().max(LIMITS.instruction),
      previous: Pack,
    })
    .optional(),
});
export type PackRequest = z.infer<typeof PackRequest>;

export const RouteRequest = z.object({
  lang,
  description: z.string().trim().min(1).max(LIMITS.description),
  profile: LearnerProfile.default({}),
});
export type RouteRequest = z.infer<typeof RouteRequest>;

export const EpisodeRequest = z.object({
  lang,
  description: z.string().trim().min(1).max(LIMITS.description),
  profile: LearnerProfile.default({}),
});
export type EpisodeRequest = z.infer<typeof EpisodeRequest>;

export const InterviewQuestion = z.object({
  kind: z.enum(["comprehension", "reply", "personal"]),
  /** What the learner sees, in Spanish. */
  prompt: es,
  /** Optional target-language line to listen to or answer (playable with the native voice). */
  text: line.optional(),
});
export type InterviewQuestion = z.infer<typeof InterviewQuestion>;

export const InterviewTurn = z.object({
  question: InterviewQuestion,
  answer: z.string().max(LIMITS.description),
});

export const InterviewRequest = z.object({
  lang,
  profile: LearnerProfile.default({}),
  history: z.array(InterviewTurn).max(LIMITS.interviewTurns),
});
export type InterviewRequest = z.infer<typeof InterviewRequest>;

/** What Claude returns for one interview step (structured output). */
export const InterviewStep = z.object({
  done: z.boolean(),
  question: InterviewQuestion.optional(),
  assessment: Assessment.optional(),
});
export type InterviewStep = z.infer<typeof InterviewStep>;

export const TtsRequest = z.object({
  text: z.string().trim().min(1).max(LIMITS.ttsText),
  voice: z.string().min(1).max(80),
  /** Read at rate −30 % (Modo deporte's slow lines); absent or false = normal rate. */
  slow: z.boolean().optional(),
});

export const CapRequest = z.object({
  capUsd: z.number().min(0).max(1000),
});

// ---- Mi entrevista: the private deck (docs/mock-interview.md "Deck") ----

/**
 * Sizes of the interview deck. Every English line (question, variant, model-answer sentence,
 * phrase) is spoken as one `/api/coach/tts/` line, so none goes over `LIMITS.ttsText` (300).
 */
export const DECK_LIMITS = {
  /** `PUT /api/coach/deck/` body, in bytes (UTF-8). */
  bytes: 512 * 1024,
  id: 64,
  learner: 600,
  blocks: 20,
  cards: 200,
  title: 80,
  intro: 400,
  variants: 5,
  answer: { min: 1, max: 20 },
  anchors: 8,
  anchor: 80,
  phrases: 10,
  note: 300,
  tip: 600,
  pending: 600,
  seconds: { min: 10, max: 300 },
} as const;
const D = DECK_LIMITS;

const deckId = z
  .string()
  .min(1)
  .max(D.id)
  .regex(/^[A-Za-z0-9_-]+$/, "letters, digits, - and _ only");
/** An English line read aloud (question, variant, sentence, phrase). */
const spoken = z.string().min(1).max(LIMITS.ttsText);
/** One sentence of the model answer or a key phrase: English and its Spain Spanish meaning. */
const deckLine = z.object({ en: spoken, es: z.string().min(1).max(LIMITS.ttsText) });

export const DeckBlock = z.object({
  id: deckId,
  title: z.string().min(1).max(D.title),
  intro: z.string().max(D.intro).optional(),
});
export type DeckBlock = z.infer<typeof DeckBlock>;

export const DeckCard = z.object({
  id: deckId,
  block: deckId,
  title: z.string().min(1).max(D.title),
  question: spoken,
  variants: z.array(spoken).max(D.variants),
  answer: z.array(deckLine).min(D.answer.min).max(D.answer.max),
  anchors: z.array(z.string().min(1).max(D.anchor)).max(D.anchors),
  phrases: z.array(deckLine.extend({ note: z.string().max(D.note).optional() })).max(D.phrases),
  tip: z.string().max(D.tip).optional(),
  /** Part of the model answer is not confirmed yet: «Falta un dato», and the corrector is told. */
  pending: z.string().max(D.pending).nullable().optional(),
  /** Target length of a spoken answer. */
  seconds: z.number().int().min(D.seconds.min).max(D.seconds.max).optional(),
});
export type DeckCard = z.infer<typeof DeckCard>;

/** What the counts cannot say: ids are unique and every card's block exists. */
function checkDeck(deck: { blocks: DeckBlock[]; cards: DeckCard[] }, ctx: z.RefinementCtx): void {
  const blocks = new Set<string>();
  deck.blocks.forEach((block, i) => {
    if (blocks.has(block.id)) ctx.addIssue({ code: "custom", path: ["blocks", i, "id"], message: "duplicate block id" });
    blocks.add(block.id);
  });
  const cards = new Set<string>();
  deck.cards.forEach((card, i) => {
    if (cards.has(card.id)) ctx.addIssue({ code: "custom", path: ["cards", i, "id"], message: "duplicate card id" });
    cards.add(card.id);
    if (!blocks.has(card.block)) ctx.addIssue({ code: "custom", path: ["cards", i, "block"], message: "unknown block" });
  });
}

/** The owner's private deck: uploaded by `npm run deck:push`, kept in Upstash and on the device. */
export const InterviewDeck = z
  .object({
    version: z.literal(1),
    /** ISO date of the source file. */
    generated: z.string().min(1).max(40),
    /** Neutral description of the learner for the prompts; absent → a generic one. */
    learner: z.string().max(D.learner).optional(),
    blocks: z.array(DeckBlock).min(1).max(D.blocks),
    cards: z.array(DeckCard).min(1).max(D.cards),
  })
  .superRefine(checkDeck);
export type InterviewDeck = z.infer<typeof InterviewDeck>;

// ---- Mi entrevista: interviewer turn, answer feedback, simulacro report (docs/mock-interview.md "Schemas") ----

/**
 * Sizes of what Claude writes for Mi entrevista. Structured outputs do not enforce them, so the
 * prompts and the schema descriptions repeat them; normalize.ts trims a list over its maximum (and
 * `improved` over its length) before the zod check. The interviewer's line is never trimmed: a
 * line over its limit fails.
 */
export const MOCK_LIMITS = {
  /** Interviewer: one spoken follow-up question and the short reaction before it. */
  line: 200,
  lineWords: 25,
  ack: 80,
  /** Answer feedback. */
  mistakes: 6,
  pronunciation: 4,
  invented: 4,
  fillers: 5,
  fluencyNote: 200,
  improved: 1200,
  /** Simulacro report. */
  reportList: 4,
} as const;
const M = MOCK_LIMITS;

export const MockTone = z.enum(["friendly", "tough"]);
export type MockTone = z.infer<typeof MockTone>;

const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;

/** 1 (no real answer) to 5 (natural, clear, correct); normalize.ts clamps a value outside. */
const score = z.number().int().min(1).max(5).describe("An integer from 1 to 5.");
/** A learner-facing sentence or two in Spain Spanish. */
const esText = (max: number) => z.string().min(1).max(max);

/** The interviewer's decision after an answer: one follow-up question, or move on. */
export const InterviewerTurn = z
  .object({
    kind: z.enum(["followup", "move_on"]),
    line: z
      .string()
      .min(1)
      .max(M.line)
      .describe(
        `Only with "followup": the one question to ask, in spoken English, at most ${M.lineWords} words and ${M.line} characters. Leave it out with "move_on".`,
      )
      .optional(),
    ack: z
      .string()
      .min(1)
      .max(M.ack)
      .describe(`A short spoken reaction in English, at most 8 words and never more than ${M.ack} characters.`),
  })
  .superRefine((turn, ctx) => {
    if (turn.kind === "followup" && !turn.line) {
      ctx.addIssue({ code: "custom", path: ["line"], message: "a follow-up needs a line" });
    }
    if (turn.line && wordCount(turn.line) > M.lineWords) {
      ctx.addIssue({ code: "custom", path: ["line"], message: `more than ${M.lineWords} words` });
    }
  });
export type InterviewerTurn = z.infer<typeof InterviewerTurn>;

/**
 * The correction of one spoken answer, with the same meaning as the cards panel's keys (`nota`,
 * `resumen`, `errores`, `pronunciacion`, `contenido`, `version`, `siguiente`) plus `invented` and
 * `fluency`. The analysis comes before `score` and `summary`, so they are written last.
 */
export const AnswerFeedback = z.object({
  invented: z
    .array(z.object({ claim: z.string().min(1).max(300), why: esText(300) }))
    .max(M.invented)
    .describe(`Claims the model answer does not support, the most serious first; an empty list if none; never more than ${M.invented}.`),
  mistakes: z
    .array(z.object({ said: z.string().min(1).max(300), better: z.string().min(1).max(300), why: esText(300) }))
    .max(M.mistakes)
    .describe(`The most important first; an empty list if none; never more than ${M.mistakes}.`),
  pronunciation: z
    .array(esText(200))
    .max(M.pronunciation)
    .describe(`Possible issues only; an empty list if nothing suggests one; never more than ${M.pronunciation}.`),
  fluency: z.object({
    fillers: z
      .array(z.string().min(1).max(80))
      .max(M.fillers)
      .describe(`Quoted as they appear, the most frequent first; an empty list if none; never more than ${M.fillers}.`),
    note: z.string().max(M.fluencyNote).describe(`One short sentence, at most ${M.fluencyNote} characters.`),
  }),
  content: esText(800).describe("1 or 2 sentences."),
  score,
  summary: esText(500).describe("1 or 2 short sentences."),
  improved: z
    .string()
    .min(1)
    .max(M.improved)
    .describe(`Spoken English, at most 170 words and never more than ${M.improved} characters.`),
  next: esText(400).describe("One concrete thing, one sentence."),
});
export type AnswerFeedback = z.infer<typeof AnswerFeedback>;

/** The simulacro's overall report, written from the answers' corrections (Spain Spanish). */
export const MockReport = z.object({
  invented: z
    .array(esText(300))
    .max(M.reportList)
    .describe(`Only claims the corrections list, the most serious first; an empty list if none; never more than ${M.reportList}.`),
  strengths: z.array(esText(200)).max(M.reportList).describe(`2 to ${M.reportList} items; never more than ${M.reportList}.`),
  weakPoints: z.array(esText(200)).max(M.reportList).describe(`2 to ${M.reportList} items, the most important first; never more than ${M.reportList}.`),
  score,
  summary: esText(600).describe("2 or 3 sentences."),
  next: esText(400).describe("One concrete thing, one sentence."),
});
export type MockReport = z.infer<typeof MockReport>;
