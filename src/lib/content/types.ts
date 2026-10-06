/**
 * Runtime (normalised) content types used by the UI. Built by `scripts/content.ts` from the
 * source JSON (see `./schema.ts`) and read through `@/lib/content` (`getPack()` and helpers).
 *
 * Every playable thing is a `Playable`: it has `text` (what is spoken) and a stable `audioKey`
 * derived from ids (see `audioKey()` in `./keys.ts`). Pass it straight to `speak()` from
 * `@/lib/audio`.
 */
import type { z } from "zod";
import type * as S from "./schema";

export type Register = z.infer<typeof S.Register>;
export type Situation = z.infer<typeof S.Situation>;
export type PackMeta = z.infer<typeof S.PackMeta>;
export type Level = z.infer<typeof S.Level>;

/**
 * Derived CEFR level of an item: the level of the unit that defines it (or of the story, for an
 * inline story key word) in a pack with `levels`. Absent in packs without levels and for extras.
 */
export interface Levelled {
  level?: Level;
}

/** Anything that can be spoken: pass it to `speak()`. */
export interface Playable {
  /** Target-language text that is spoken. */
  text: string;
  /**
   * Stable key derived from ids. `/audio/<lang>/manifest.json` maps it to its mp3
   * (`/audio/<lang>/<hash of voice + text>.mp3`, written by `npm run audio`).
   */
  audioKey: string;
  /** Voice name from pack meta (always resolved, never undefined). */
  voice: string;
}

/**
 * A picture ready to show (pass it to `<Picture image={…} />` from `@/components/ui`). Present on
 * an item only when its file exists in `public/images/` (written by `npm run images`), so the UI
 * never shows a broken image: no `image` = show text only.
 */
export interface ImageRef {
  /** Absolute URL of the SVG ("/images/fluent/hot-beverage.svg"); precached for offline use. */
  src: string;
  /** Mostly near-black picture: `Picture` adds a soft light round backdrop in dark theme. */
  dark?: boolean;
}

export type Phrase = Omit<z.infer<typeof S.Phrase>, "voice"> & Playable & Levelled & { kind: "phrase" };

/**
 * `text` = article + word as spoken ("il biglietto", "l'orario"); `word` = bare word.
 * `imageKey` = the source picture key (`fluent:…` | `custom:…`) when the content sets one;
 * `image` = the resolved picture, only when its file exists (use `image`, not `imageKey`, in UI).
 */
export type Vocab = Omit<z.infer<typeof S.Vocab>, "voice" | "image"> &
  Playable &
  Levelled & { kind: "vocab"; imageKey?: string; image?: ImageRef };

/** A vocab item that has a picture (see `listVocab({ withImage: true })`, `hasImage()`). */
export type PicturedVocab = Vocab & { image: ImageRef };

export type Reply = z.infer<typeof S.Reply> & Playable;

/** `text`/`audioKey`/`voice` refer to the question. Replies are playable too. */
export type QA = Omit<z.infer<typeof S.QA>, "voice" | "accepted" | "distractors"> &
  Playable &
  Levelled & { kind: "qa"; accepted: Reply[]; distractors: Reply[] };

export type GrammarCard = Omit<z.infer<typeof S.GrammarCard>, "examples"> &
  Levelled & {
  kind: "grammar";
  examples: Reply[];
};

export type Expression = Omit<z.infer<typeof S.Expression>, "voice"> & Playable & Levelled & { kind: "expression" };

export type LessonItem = Phrase | Vocab | QA | GrammarCard | Expression;
export type LessonItemKind = LessonItem["kind"];

export interface Lesson {
  id: string;
  title: string;
  /** Ids in teaching order; resolve with `getLessonItems(lesson)`. */
  items: string[];
  /** Id of the unit that contains it. */
  unitId: string;
  /** 0-based position inside the unit. */
  index: number;
}

export interface Unit {
  id: string;
  order: number;
  title: string;
  description?: string;
  emoji?: string;
  situation: string;
  /** CEFR level (packs with `levels` only). */
  level?: Level;
  lessons: Lesson[];
}

/** `avatar` = the speaker's picture (dialogue `avatars[name]`), only when its file exists. */
export type NativeTurn = Omit<z.infer<typeof S.NativeTurn>, "voice"> & Playable & { avatar?: ImageRef };
export type LearnerOption = z.infer<typeof S.LearnerOption> & Playable;
export type LearnerTurn = Omit<z.infer<typeof S.LearnerTurn>, "options"> & { options: LearnerOption[] };
export type DialogueTurn = NativeTurn | LearnerTurn;

/**
 * `avatars` keeps the source keys (speaker name → picture key) for the image pipeline; the UI
 * reads the resolved `avatar` on each native turn instead.
 */
export type Dialogue = Omit<z.infer<typeof S.DialogueFile>, "turns"> & { turns: DialogueTurn[] };

export type PlacementQuestion = Omit<z.infer<typeof S.PlacementQuestion>, "voice"> & {
  /** Present only when the question has `text`. */
  audio?: Playable;
};

/** Audio key `<storyId>--<sentenceId>`; voice = sentence voice or story voice. */
export type StorySentence = Omit<z.infer<typeof S.StorySentence>, "voice"> & Playable;

/**
 * `text`/`audioKey` (`<storyId>--<questionId>`)/`voice` refer to the question. Options are
 * playable (`<storyId>--<questionId>--<n>`, n 1-based); `correct` is the 0-based right option.
 */
export type StoryQuestion = Omit<z.infer<typeof S.StoryQuestion>, "options"> &
  Playable & { options: Reply[] };

/** Fill-the-gap item: `before + gap + after` is exactly the sentence text. */
export interface StoryGap {
  id: string;
  /** Sentence id inside the story. */
  sentence: string;
  /** Key word id that fills the gap (resolve with `getItem()`); record SRS outcomes on it. */
  answer: string;
  /** Right chip, as written in the sentence. */
  gap: string;
  /** Sentence text before / after the gap. */
  before: string;
  after: string;
  /** Wrong chips (≥ 2). */
  distractors: string[];
}

/** What a story key word resolves to: a playable pack item with `text` and `es`. */
export type StoryKeyword = Vocab | Phrase | Expression;

export interface Story {
  id: string;
  /** Trip order (stories are sorted by it). */
  order: number;
  /** Target-language title. */
  title: string;
  /** Spanish title. */
  titleEs: string;
  description?: string;
  emoji?: string;
  situation: string;
  level: Level;
  /** Narrator voice (resolved). */
  voice: string;
  sentences: StorySentence[];
  /** Key word item ids (vocab / phrase / expression); resolve with `getStoryKeywords(story)`. */
  keywords: string[];
  questions: StoryQuestion[];
  gaps: StoryGap[];
  /** Words in all sentences (guideline 80–150). */
  wordCount: number;
}

/** A whole language pack, normalised and validated. Arrays are sorted for display. */
export interface Pack {
  meta: PackMeta;
  /** Sorted by `order`. */
  units: Unit[];
  /** Sorted by `order`, then id. */
  dialogues: Dialogue[];
  /** Sorted by `order`. Inline story key words are in `vocab`. */
  stories: Story[];
  phrases: Phrase[];
  vocab: Vocab[];
  qa: QA[];
  grammar: GrammarCard[];
  expressions: Expression[];
  placement: PlacementQuestion[];
}
