/**
 * The home path: units in `order` with lesson states. Units from `SIDE_ORDER` up (minimal
 * grammar, Sicilian: see docs/content-guide.md "Unit order ranges") are side content: always
 * open and outside the main sequence.
 *
 * Locking: the first lesson of every main unit is open (jump to the situation you need); inside a
 * unit each lesson opens when the previous one is done. The current lesson is the first main
 * lesson not done.
 *
 * Packs split by level (`pack.json` `levels`): the path shows one level's units only (`level`),
 * and side units are those at `SIDE_ORDER` or more inside their hundred (`order % 100`: each level
 * owns a range of 100, grammar at x90; docs/brief-en.md). Progress of other levels is untouched.
 */
import { getLevels, type Lesson, type Level, type Pack, type Unit } from "@/lib/content";
import type { Progress } from "./index";

export const SIDE_ORDER = 90;

export type LessonState = "done" | "current" | "available" | "locked";

export interface PathLesson {
  lesson: Lesson;
  state: LessonState;
}

export interface PathUnit {
  unit: Unit;
  lessons: PathLesson[];
  done: number;
  side: boolean;
}

export interface PathModel {
  units: PathUnit[];
  current?: Lesson;
  /** Main path totals. */
  done: number;
  total: number;
  /** Every lesson shown (the level's, in a levelled pack), side units included. */
  allDone: number;
  allTotal: number;
}

/** True for side units (always open, outside the main sequence). */
function isSide(unit: Unit, levelled: boolean): boolean {
  return (levelled ? unit.order % 100 : unit.order) >= SIDE_ORDER;
}

/** `level` = the learner's level, for a pack with `levels` (ignored otherwise). */
export function buildPath(pack: Pack, progress: Progress, level?: Level | null): PathModel {
  const isDone = (id: string) => id in progress.lessons;
  const levelled = getLevels(pack).length > 0;
  const shown = levelled && level ? pack.units.filter((u) => u.level === level) : pack.units;
  const main = shown.filter((u) => !isSide(u, levelled));
  const current = main.flatMap((u) => u.lessons).find((l) => !isDone(l.id));
  const units = shown.map((unit): PathUnit => {
    const side = isSide(unit, levelled);
    const lessons = unit.lessons.map((lesson, i): PathLesson => {
      if (isDone(lesson.id)) return { lesson, state: "done" };
      if (lesson.id === current?.id) return { lesson, state: "current" };
      const open = side || i === 0 || isDone(unit.lessons[i - 1].id);
      return { lesson, state: open ? "available" : "locked" };
    });
    return { unit, lessons, done: lessons.filter((l) => l.state === "done").length, side };
  });
  const mainUnits = units.filter((u) => !u.side);
  return {
    units,
    current,
    done: mainUnits.reduce((n, u) => n + u.done, 0),
    total: mainUnits.reduce((n, u) => n + u.lessons.length, 0),
    allDone: units.reduce((n, u) => n + u.done, 0),
    allTotal: units.reduce((n, u) => n + u.lessons.length, 0),
  };
}

/** Route of a lesson (static export uses trailing slashes). */
export function lessonHref(lessonId: string): string {
  return `/leccion/${encodeURIComponent(lessonId)}/`;
}
