/**
 * Prepárate wire schemas (zod), server only: the pack, the quick route, the learner context, every
 * request body and the interview. The only definition of the pack and route schemas; docs/coach.md
 * mirrors them for the client, which gets plain TypeScript types (src/ never imports zod).
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
});

export const CapRequest = z.object({
  capUsd: z.number().min(0).max(1000),
});
