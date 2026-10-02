/**
 * Prepárate wire schemas (zod), server only: the pack, the learner context, every request body
 * and the interview. The only definition of the pack schema; docs/coach.md mirrors it for the
 * client, which gets plain TypeScript types (src/ never imports zod).
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
  options: z.array(GeneratedOption).min(2).max(3),
});

export const GeneratedPack = z.object({
  title: z.string().min(1).max(80),
  register: z.enum(["formal", "informal"]),
  guide: z.array(z.object({ es })).min(3).max(7),
  keyPhrases: z
    .array(z.object({ text: line, es, note: z.string().max(200).optional() }))
    .min(8)
    .max(12),
  dialogue: z.object({
    title: z.string().min(1).max(80),
    turns: z.array(z.discriminatedUnion("speaker", [GeneratedNativeTurn, GeneratedLearnerTurn])).min(6).max(10),
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
    turns: z.array(z.discriminatedUnion("speaker", [NativeTurn, LearnerTurn])).min(6).max(10),
  }),
  refinements: z.number().int().min(0),
});
export type Pack = z.infer<typeof Pack>;

// ---- Learner context (built on the device) ----

export const Level = z.enum(["A0", "A1", "A2", "B1", "B2", "C1", "C2"]);

export const Assessment = z.object({
  level: Level,
  summary: z.string().min(1).max(600),
  strengths: z.array(z.string().max(200)).max(8),
  weakPoints: z.array(z.string().max(200)).max(8),
  facts: z.array(z.string().max(200)).max(10),
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
