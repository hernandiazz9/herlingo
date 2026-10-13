/** Pack, quick route, episode and interview generators: fake (canned) or real (Claude, prompts in prompts.ts). */
import { generateStructured } from "./claude.js";
import { isFake } from "./config.js";
import {
  FAKE_EPISODE_USAGE,
  FAKE_INTERVIEW_USAGE,
  FAKE_PACK_USAGE,
  FAKE_ROUTE_USAGE,
  fakeEpisode,
  fakeInterviewStep,
  fakePack,
  fakeRoute,
} from "./fake.js";
import type { LanguageMeta } from "./languages.js";
import { COACH_MODEL, sumUsage, type Charge } from "./model.js";
import { normalizeAssessment, normalizeEpisode, normalizeInterviewStep, normalizePack, normalizeRoute } from "./normalize.js";
import {
  EPISODE_SYSTEM,
  INTERVIEW_SYSTEM,
  PACK_SYSTEM,
  ROUTE_SYSTEM,
  episodeUserPrompt,
  interviewUserPrompt,
  packUserPrompt,
  routeUserPrompt,
  type EpisodeInput,
  type PackInput,
  type RouteInput,
} from "./prompts.js";
import {
  Assessment,
  GeneratedEpisode,
  GeneratedPack,
  GeneratedRoute,
  InterviewStep,
  LIMITS,
  type InterviewRequest,
} from "./schema.js";

export type OnUsage = (charges: Charge[]) => Promise<unknown>;

/**
 * Low effort for all: content generation is Sonnet 5.5's `low` use case, and a pack must come back
 * well inside the functions' 60 s. Output caps sit far above a normal answer (~3k pack, ~2k route,
 * ~5k episode, ~0.5k step).
 */
const PACK = { effort: "low", maxTokens: 8000 } as const;
const ROUTE = { effort: "low", maxTokens: 6000 } as const;
/**
 * An episode is ~4–6k output tokens, ~30–45 s at ~135 tok/s: close to the default 50 s deadline, so
 * it gets 55 s (vercel.json stops the function at 60 s; packs, routes and the interview keep 50 s).
 */
const EPISODE = { effort: "low", maxTokens: 12000, deadlineMs: 55_000 } as const;
const INTERVIEW = { effort: "low", maxTokens: 4000 } as const;

export async function generatePack(input: PackInput, onUsage: OnUsage): Promise<GeneratedPack> {
  if (isFake()) {
    await onUsage([{ model: COACH_MODEL, usage: FAKE_PACK_USAGE }]);
    return fakePack(input.meta, input.description, input.refine?.instruction);
  }
  return generateStructured({ ...PACK, system: PACK_SYSTEM, user: packUserPrompt(input), schema: GeneratedPack, normalize: normalizePack, onUsage });
}

/** A quick route (Modo rápido); its own prompt and schema, the pack's call. */
export async function generateRoute(input: RouteInput, onUsage: OnUsage): Promise<GeneratedRoute> {
  if (isFake()) {
    await onUsage([{ model: COACH_MODEL, usage: FAKE_ROUTE_USAGE }]);
    return fakeRoute(input.meta, input.description);
  }
  return generateStructured({ ...ROUTE, system: ROUTE_SYSTEM, user: routeUserPrompt(input), schema: GeneratedRoute, normalize: normalizeRoute, onUsage });
}

/**
 * A Modo deporte episode (docs/sport.md); its own prompt and schema, the pack's call. Every real
 * call logs one `[coach] episode …` line: latency until the response (or the failure), output
 * tokens, the model that answered and the outcome (never the learner's text).
 */
export async function generateEpisode(input: EpisodeInput, onUsage: OnUsage): Promise<GeneratedEpisode> {
  if (isFake()) {
    await onUsage([{ model: COACH_MODEL, usage: FAKE_EPISODE_USAGE }]);
    return fakeEpisode(input.meta, input.description);
  }
  const started = Date.now();
  let answeredMs: number | undefined;
  let charges: Charge[] = [];
  let outcome = "failed";
  try {
    const episode = await generateStructured({
      ...EPISODE,
      system: EPISODE_SYSTEM,
      user: episodeUserPrompt(input),
      schema: GeneratedEpisode,
      normalize: normalizeEpisode,
      onUsage: (call) => {
        answeredMs = Date.now() - started;
        charges = call;
        return onUsage(call);
      },
    });
    outcome = "ok";
    return episode;
  } finally {
    const ms = answeredMs ?? Date.now() - started;
    const output = sumUsage(charges).output;
    const model = charges.at(-1)?.model ?? "none";
    const rate = answeredMs && output ? Math.round(output / (answeredMs / 1000)) : 0;
    console.log(`[coach] episode ${outcome} ${ms} ms, ${output} output tokens (${rate} tok/s), model ${model}, lang ${input.meta.lang}`);
  }
}

export async function generateInterviewStep(req: InterviewRequest, meta: LanguageMeta, onUsage: OnUsage): Promise<InterviewStep> {
  if (isFake()) {
    await onUsage([{ model: COACH_MODEL, usage: FAKE_INTERVIEW_USAGE }]);
    return fakeInterviewStep(meta, req.history.length);
  }
  const final = req.history.length >= LIMITS.interviewTurns;
  const common = { ...INTERVIEW, system: INTERVIEW_SYSTEM, user: interviewUserPrompt(meta, req, final), onUsage };
  if (final) return { done: true, assessment: await generateStructured({ ...common, schema: Assessment, normalize: normalizeAssessment }) };
  return generateStructured({ ...common, schema: InterviewStep, normalize: normalizeInterviewStep });
}
