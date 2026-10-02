/**
 * Pack and interview generators: fake (canned) or real (Claude). The real prompts are a first
 * version, refined by T43; the system prompts stay byte-stable so they are cached.
 */
import { generateStructured } from "./claude";
import { isFake } from "./config";
import { FAKE_INTERVIEW_USAGE, FAKE_PACK_USAGE, fakeInterviewStep, fakePack } from "./fake";
import type { LanguageMeta } from "./languages";
import { COACH_MODEL, type TokenUsage } from "./model";
import {
  GeneratedPack,
  InterviewStep,
  LIMITS,
  type InterviewRequest,
  type LearnerProfile,
  type Pack,
} from "./schema";

export type OnUsage = (model: string, usage: TokenUsage) => Promise<unknown>;

export interface PackInput {
  meta: LanguageMeta;
  description: string;
  profile: LearnerProfile;
  refine?: { instruction: string; previous: Pack };
}

const PACK_SYSTEM = `You prepare a Spanish-speaking learner (Spain Spanish, "tú") for one real-life situation in the language they are learning.
Write a preparation pack as JSON matching the schema:
- title: short Spanish title of the situation.
- register: "formal" when the learner talks to strangers or staff, "informal" with peers.
- guide: 3 to 7 short steps in Spanish describing how the situation usually unfolds and what to do.
- keyPhrases: 8 to 12 natural spoken phrases in the target language the learner will say or hear, each with a Spain Spanish translation (es) and an optional short note.
- dialogue: a scripted role-play of 6 to 10 turns alternating native speaker lines (speaker "native", with text and es) and learner turns (speaker "learner": prompt in Spanish saying what to express, and 2 or 3 options with verdict correct/acceptable/wrong and short Spanish feedback addressed with "tú").
Adapt difficulty to the learner context. Use natural, current spoken language of the given region; never invent facts about prices or schedules beyond typical values.`;

const INTERVIEW_SYSTEM = `You run a short spoken-language level interview for a Spanish-speaking learner (Spain Spanish, "tú").
Ask one question at a time, mixing comprehension (a target-language line to understand), "reply" (a target-language line to answer) and personal questions about the learner's trip.
Return JSON: {done:false, question:{kind, prompt (Spanish), text? (target language)}} for the next question, or after about 8 answers {done:true, assessment:{level (CEFR), summary, strengths, weakPoints, facts the learner shared}} in Spanish.`;

function learnerContext(meta: LanguageMeta, profile: LearnerProfile): string {
  return JSON.stringify({ language: meta.name, locale: meta.speechLocale, learner: profile });
}

export async function generatePack(input: PackInput, onUsage: OnUsage): Promise<GeneratedPack> {
  if (isFake()) {
    await onUsage(COACH_MODEL, FAKE_PACK_USAGE);
    return fakePack(input.meta, input.description, input.refine?.instruction);
  }
  const parts = [
    `Context: ${learnerContext(input.meta, input.profile)}`,
    `Situation (learner's words): ${input.description}`,
  ];
  if (input.refine) {
    const { title, register, guide, keyPhrases, dialogue } = input.refine.previous;
    const previous = { title, register, guide, keyPhrases, dialogue };
    parts.push(
      `Previous pack: ${JSON.stringify(previous)}`,
      input.refine.instruction
        ? `Rewrite it applying this instruction: ${input.refine.instruction}`
        : "Write a different version of the same situation.",
    );
  }
  const result = await generateStructured({
    system: PACK_SYSTEM,
    user: parts.join("\n\n"),
    schema: GeneratedPack,
    effort: "medium",
    maxTokens: 16000,
    onUsage,
  });
  return result.data;
}

export async function generateInterviewStep(req: InterviewRequest, meta: LanguageMeta, onUsage: OnUsage): Promise<InterviewStep> {
  if (isFake()) {
    await onUsage(COACH_MODEL, FAKE_INTERVIEW_USAGE);
    return fakeInterviewStep(meta, req.history.length);
  }
  const mustFinish = req.history.length >= LIMITS.interviewTurns;
  const result = await generateStructured({
    system: INTERVIEW_SYSTEM,
    user: [
      `Context: ${learnerContext(meta, req.profile)}`,
      `Interview so far: ${JSON.stringify(req.history)}`,
      mustFinish ? "This is the last step: return the final assessment." : "",
    ].join("\n\n"),
    schema: InterviewStep,
    effort: "low",
    maxTokens: 4000,
    onUsage,
  });
  return result.data;
}
