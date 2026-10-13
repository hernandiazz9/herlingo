/**
 * Prepárate wire types for the client: plain TypeScript written from the server's zod schemas
 * (api/_lib/schema.ts, the only definition; docs/coach.md documents both). src/ never imports
 * zod or api/ code.
 */
import type { StoredEpisode } from "@/lib/sport/types";

/** An AI episode (Modo deporte): its model lives with the episode compiler (`@/lib/sport`). */
export type { StoredEpisode };

/** Mirror of the server's `LIMITS` (api/_lib/schema.ts): input limits and per-pack refinements. */
export const COACH_LIMITS = {
  description: 500,
  instruction: 200,
  ttsText: 300,
  about: 1000,
  refinementsPerPack: 3,
  interviewTurns: 10,
} as const;

export type Verdict = "correct" | "acceptable" | "wrong";

export interface CoachOption {
  text: string;
  es: string;
  verdict: Verdict;
  feedback: string;
}

export interface CoachNativeTurn {
  id: string;
  speaker: "native";
  name?: string;
  text: string;
  es: string;
}

export interface CoachLearnerTurn {
  id: string;
  speaker: "learner";
  /** Spanish: what the learner has to express. */
  prompt: string;
  options: CoachOption[];
}

export type CoachTurn = CoachNativeTurn | CoachLearnerTurn;

export interface CoachKeyPhrase {
  /** Target-language text. */
  text: string;
  es: string;
  note?: string;
}

/** A preparation pack as the server returns it and the device stores it. */
export interface CoachPack {
  /** Kept by refinements. */
  id: string;
  /** ISO date of this version. */
  createdAt: string;
  lang: string;
  /** The learner's own words. */
  description: string;
  title: string;
  register: "formal" | "informal";
  /** TTS voices: `native` for native turns and key phrases, `learner` for learner options. */
  voices: { native: string; learner: string };
  guide: { es: string }[];
  keyPhrases: CoachKeyPhrase[];
  dialogue: { title: string; turns: CoachTurn[] };
  /** Refinements used (0–3). */
  refinements: number;
}

/** Mirror of the server's `ROUTE_ARRAY_LIMITS` (api/_lib/schema.ts): item counts of a quick route. */
export const COACH_ROUTE_LIMITS = {
  turns: { min: 4, max: 10 },
  alts: 3,
  words: 4,
} as const;

/** A target-language line of a quick route and its Spain Spanish translation (an alternative or a key word). */
export interface CoachRouteLine {
  /** Target-language text. */
  text: string;
  es: string;
}

/** One turn of a quick route: the main line, other ways to say it and its key words. */
export interface CoachRouteTurn {
  /** "r1"…"rn", assigned by the server. */
  id: string;
  speaker: "native" | "learner";
  /** The main line (target language). */
  text: string;
  es: string;
  /** 0–3: other ways they may say it (native) or other answers (learner). */
  alts: CoachRouteLine[];
  /** 0–4: key words or chunks of this turn. */
  words: CoachRouteLine[];
}

/** A quick route (Modo rápido) as the server returns it and the device stores it. */
export interface CoachRoute {
  id: string;
  /** ISO date it was generated. */
  createdAt: string;
  lang: string;
  /** The learner's own words. */
  description: string;
  /** Spanish. */
  title: string;
  register: "formal" | "informal";
  /** TTS voices: `native` for native turns, their alts and every turn's words; `learner` for learner turns and their alts. */
  voices: { native: string; learner: string };
  /** Alternating, the learner first (4–10 from the server). */
  turns: CoachRouteTurn[];
}

export type CoachLevel = "A0" | "A1" | "A2" | "B1" | "B2" | "C1" | "C2";

/** Result of the level interview (Spanish texts). */
export interface CoachAssessment {
  level: CoachLevel;
  summary: string;
  strengths: string[];
  weakPoints: string[];
  facts: string[];
}

/** An assessment as stored on the device. */
export interface DatedAssessment extends CoachAssessment {
  /** ISO date it was received. */
  date: string;
}

/** Learner context sent with pack and interview requests (built by `buildLearnerContext`). */
export interface LearnerContext {
  progress?: {
    lessonsDone: number;
    lessonsTotal: number;
    wordsLearned: number;
    xp: number;
    placement?: string | null;
  };
  assessment?: CoachAssessment & { date?: string };
  about?: string;
}

export interface InterviewQuestion {
  kind: "comprehension" | "reply" | "personal";
  /** Spanish, shown to the learner. */
  prompt: string;
  /** Target-language line to listen to or answer (native voice): `questionPlayable()`. */
  text?: string;
}

export interface InterviewTurn {
  question: InterviewQuestion;
  answer: string;
}

/** Usage summary of `GET /api/coach/usage/`. */
export interface CoachUsage {
  /** "YYYY-MM". */
  month: string;
  spentUsd: number;
  capUsd: number;
  remainingUsd: number;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number };
  /** New packs this month (refinements excluded). */
  packs: number;
  avgPackUsd: number;
  /** Generations today by the caller's code. */
  today: { used: number; limit: number };
  isOwner: boolean;
  /** Spent this month by the caller's code. */
  mineUsd: number;
  /** Quick routes billed this month (absent from servers and stored summaries without routes). */
  routes?: number;
  /** Their average cost (absent like `routes`). */
  avgRouteUsd?: number;
  /** Quick routes today by the caller's code: their own counter, apart from `today` (absent like `routes`). */
  routesToday?: { used: number; limit: number };
  /** AI episodes (Modo deporte) billed this month (absent from servers and stored summaries without episodes). */
  episodes?: number;
  /** Their average cost (absent like `episodes`). */
  avgEpisodeUsd?: number;
  /** AI episodes today by the caller's code: their own counter (absent like `episodes`). */
  episodesToday?: { used: number; limit: number };
}

/** The `usage` part of a generation response (for a route or an episode, `today` is its own counter). */
export interface GenerationUsage {
  costUsd: number;
  remainingUsd: number;
  today: { used: number; limit: number };
}

export interface PackResult {
  pack: CoachPack;
  usage: GenerationUsage;
}

export interface RouteResult {
  route: CoachRoute;
  usage: GenerationUsage;
}

/** Mirror of the server's `EPISODE_ARRAY_LIMITS` (api/_lib/schema.ts): item counts of an AI episode. */
export const COACH_EPISODE_LIMITS = {
  parts: { min: 2, max: 6 },
  /** Across all parts. */
  steps: { min: 6, max: 20 },
  variants: 2,
} as const;

export interface EpisodeResult {
  episode: StoredEpisode;
  /** `today` is the episode counter. */
  usage: GenerationUsage;
}

export type InterviewResult =
  | { done: false; question: InterviewQuestion; turn: number; usage: GenerationUsage }
  | { done: true; assessment: CoachAssessment; usage: GenerationUsage };
