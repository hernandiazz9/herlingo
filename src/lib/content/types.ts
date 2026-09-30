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

/** Anything that can be spoken: pass it to `speak()`. */
export interface Playable {
  /** Target-language text that is spoken. */
  text: string;
  /** Stable key; mp3 (T03) lives at `/audio/<lang>/<audioKey>.mp3`. */
  audioKey: string;
  /** Voice name from pack meta (always resolved, never undefined). */
  voice: string;
}

export type Phrase = Omit<z.infer<typeof S.Phrase>, "voice"> & Playable & { kind: "phrase" };

/** `text` = article + word as spoken ("il biglietto", "l'orario"); `word` = bare word. */
export type Vocab = Omit<z.infer<typeof S.Vocab>, "voice"> & Playable & { kind: "vocab" };

export type Reply = z.infer<typeof S.Reply> & Playable;

/** `text`/`audioKey`/`voice` refer to the question. Replies are playable too. */
export type QA = Omit<z.infer<typeof S.QA>, "voice" | "accepted" | "distractors"> &
  Playable & { kind: "qa"; accepted: Reply[]; distractors: Reply[] };

export type GrammarCard = Omit<z.infer<typeof S.GrammarCard>, "examples"> & {
  kind: "grammar";
  examples: Reply[];
};

export type Expression = Omit<z.infer<typeof S.Expression>, "voice"> & Playable & { kind: "expression" };

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
  lessons: Lesson[];
}

export type NativeTurn = Omit<z.infer<typeof S.NativeTurn>, "voice"> & Playable;
export type LearnerOption = z.infer<typeof S.LearnerOption> & Playable;
export type LearnerTurn = Omit<z.infer<typeof S.LearnerTurn>, "options"> & { options: LearnerOption[] };
export type DialogueTurn = NativeTurn | LearnerTurn;

export type Dialogue = Omit<z.infer<typeof S.DialogueFile>, "turns"> & { turns: DialogueTurn[] };

export type PlacementQuestion = Omit<z.infer<typeof S.PlacementQuestion>, "voice"> & {
  /** Present only when the question has `text`. */
  audio?: Playable;
};

/** A whole language pack, normalised and validated. Arrays are sorted for display. */
export interface Pack {
  meta: PackMeta;
  /** Sorted by `order`. */
  units: Unit[];
  /** Sorted by `order`, then id. */
  dialogues: Dialogue[];
  phrases: Phrase[];
  vocab: Vocab[];
  qa: QA[];
  grammar: GrammarCard[];
  expressions: Expression[];
  placement: PlacementQuestion[];
}
