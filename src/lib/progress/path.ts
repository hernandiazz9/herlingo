/**
 * The home path: units in `order` with lesson states. Units from `SIDE_ORDER` up (minimal
 * grammar, Sicilian: see docs/content-guide.md "Unit order ranges") are side content: always
 * open and outside the main sequence.
 *
 * Locking: the first lesson of every main unit is open (jump to the situation you need); inside a
 * unit each lesson opens when the previous one is done. The current lesson is the first main
 * lesson not done.
 */
import type { Lesson, Pack, Unit } from "@/lib/content";
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
  /** Every lesson of the pack, side units included (same count as Perfil and the picker). */
  allDone: number;
  allTotal: number;
}

export function buildPath(pack: Pack, progress: Progress): PathModel {
  const isDone = (id: string) => id in progress.lessons;
  const main = pack.units.filter((u) => u.order < SIDE_ORDER);
  const current = main.flatMap((u) => u.lessons).find((l) => !isDone(l.id));
  const units = pack.units.map((unit): PathUnit => {
    const side = unit.order >= SIDE_ORDER;
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
