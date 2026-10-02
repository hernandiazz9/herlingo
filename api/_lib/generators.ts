/** Pack and interview generators: fake (canned) or real (Claude, prompts in prompts.ts). */
import { generateStructured } from "./claude";
import { isFake } from "./config";
import { FAKE_INTERVIEW_USAGE, FAKE_PACK_USAGE, fakeInterviewStep, fakePack } from "./fake";
import type { LanguageMeta } from "./languages";
import { COACH_MODEL, type Charge } from "./model";
import { INTERVIEW_SYSTEM, PACK_SYSTEM, interviewUserPrompt, packUserPrompt, type PackInput } from "./prompts";
import { Assessment, GeneratedPack, InterviewStep, LIMITS, type InterviewRequest } from "./schema";

export type OnUsage = (charges: Charge[]) => Promise<unknown>;

/**
 * Low effort for both: content generation is Sonnet 5.5's `low` use case, and a pack must come back
 * well inside the functions' 60 s. Output caps sit far above a normal answer (~3k pack, ~0.5k step).
 */
const PACK = { effort: "low", maxTokens: 8000 } as const;
const INTERVIEW = { effort: "low", maxTokens: 4000 } as const;

export async function generatePack(input: PackInput, onUsage: OnUsage): Promise<GeneratedPack> {
  if (isFake()) {
    await onUsage([{ model: COACH_MODEL, usage: FAKE_PACK_USAGE }]);
    return fakePack(input.meta, input.description, input.refine?.instruction);
  }
  return generateStructured({ ...PACK, system: PACK_SYSTEM, user: packUserPrompt(input), schema: GeneratedPack, onUsage });
}

export async function generateInterviewStep(req: InterviewRequest, meta: LanguageMeta, onUsage: OnUsage): Promise<InterviewStep> {
  if (isFake()) {
    await onUsage([{ model: COACH_MODEL, usage: FAKE_INTERVIEW_USAGE }]);
    return fakeInterviewStep(meta, req.history.length);
  }
  const final = req.history.length >= LIMITS.interviewTurns;
  const common = { ...INTERVIEW, system: INTERVIEW_SYSTEM, user: interviewUserPrompt(meta, req, final), onUsage };
  if (final) return { done: true, assessment: await generateStructured({ ...common, schema: Assessment }) };
  return generateStructured({ ...common, schema: InterviewStep });
}
