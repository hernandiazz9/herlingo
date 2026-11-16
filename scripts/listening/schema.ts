/**
 * Listening library (scripts/listening/README.md): what Claude writes (zod, sent as the structured
 * output schema) and what is stored per episode. Close to the Modo deporte episode model
 * (docs/sport.md "Episode model", src/lib/sport/types.ts), all in English: `meaning` takes the place
 * of `es`, the speaker is a cast id instead of learner / native, and `focus` marks the lines read
 * normal → slow → normal.
 */
import { z } from "zod";

export const TOPICS = ["interview", "work", "story"] as const;
export type Topic = (typeof TOPICS)[number];

const Line = z.object({
  text: z.string().describe("What the speaker says: spoken English, one to three sentences, at most 300 characters."),
  meaning: z
    .string()
    .describe('Focus steps: what it means or why it works, in plain B1 English, at most 200 characters. Other steps: "".'),
});

const Variant = z.object({
  cue: z.string().describe('Narrator cue before the variant, at most 60 characters ("A more formal way:").'),
  text: z.string().describe("Another natural way to say the line, at most 200 characters."),
  meaning: z.string().describe('"" unless the difference needs a short note (at most 120 characters).'),
});

const Step = z.object({
  speaker: z.string().describe("The cast id of who says the line."),
  intro: z.string().describe('Narrator context before the line, at most 160 characters; "" for most steps.'),
  line: Line,
  focus: z.boolean().describe("true for the 5 most reusable lines of the episode."),
  variants: z.array(Variant).describe("Focus steps: exactly 1 variant. Other steps: []."),
  tip: z.string().describe('Focus steps: a short usage, pitfall or pronunciation tip (at most 200 characters) or "". Other steps: "".'),
});

const Part = z.object({
  title: z.string().describe('Spoken part title, at most 80 characters ("Part one: the opening question.").'),
  steps: z.array(Step),
});

const CastMember = z.object({
  id: z.string().describe("Short lowercase slug, usually the first name."),
  name: z.string().describe("First name only."),
  role: z.string().describe('Who they are in the scene ("interviewer, engineering manager").'),
  gender: z.enum(["female", "male"]),
  main: z.boolean().describe("true for the two main speakers (one female, one male)."),
});

/** What Claude writes for one episode. */
export const EpisodeDraft = z.object({
  title: z.string().describe("English title, at most 60 characters."),
  description: z.string().describe("One sentence for a library list, at most 200 characters."),
  level: z.enum(["B2", "C1"]),
  register: z.enum(["formal", "informal"]),
  intro: z.string().describe("Narrator opening, at most 300 characters."),
  cast: z.array(CastMember),
  parts: z.array(Part),
  outro: z.string().describe("Narrator recap of the 2–3 most useful ideas, at most 250 characters."),
});
export type EpisodeDraft = z.infer<typeof EpisodeDraft>;

/** One request of the topic plan: episode ideas for one topic. */
export const TopicPlan = z.object({
  ideas: z.array(
    z.object({
      title: z.string().describe("Working title, at most 60 characters."),
      brief: z.string().describe("Two or three sentences: the situation, who is there, what happens, the language it trains."),
    }),
  ),
});
export type TopicPlan = z.infer<typeof TopicPlan>;

export interface TopicIdea {
  /** `<topic>-<nnn>`: also the episode id and the batch `custom_id`. */
  id: string;
  topic: Topic;
  number: number;
  title: string;
  brief: string;
}

export interface Usage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/** One episode as stored in `<out>/scripts/<id>.json` (format `herlingo-listening/1`). */
export interface ListeningEpisode extends EpisodeDraft {
  format: "herlingo-listening/1";
  id: string;
  source: "ai";
  lang: "en";
  topic: Topic;
  number: number;
  /** The idea it was written from. */
  brief: string;
  /** Voice per cast id, plus `narrator`. */
  voices: Record<string, string>;
  createdAt: string;
  generation: {
    model: string;
    mode: "batch" | "direct";
    batchId?: string;
    effort: string;
    usage: Usage;
    costUsd: number;
  };
  stats: { steps: number; focus: number; words: number; warnings: string[] };
  audio?: { file: string; seconds: number; renderedAt: string };
}
