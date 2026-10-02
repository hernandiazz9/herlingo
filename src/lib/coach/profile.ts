/**
 * What Claude knows about the learner, per language pack: the "Sobre mí" notes and the level
 * interview results (newest first), plus `buildLearnerContext()`, the short context sent with
 * every pack and interview request (progress numbers, latest assessment, notes; nothing else).
 */
import { getAllLessons, getPack } from "@/lib/content";
import { dayKey, getProgress, wordsLearned } from "@/lib/progress";
import { parseAssessment } from "./parse";
import { COACH_KEYS, readRaw, readVersioned, writeJson } from "./store";
import { COACH_LIMITS, type CoachAssessment, type DatedAssessment, type LearnerContext } from "./types";

const VERSION = 1;
/** Interview results kept on the device. */
const MAX_ASSESSMENTS = 5;

export interface LearnerProfile {
  /** "Sobre mí" notes (≤ COACH_LIMITS.about). */
  about: string;
  /** Newest first. */
  assessments: DatedAssessment[];
}

export const readProfileRaw = (lang: string): string => readRaw(COACH_KEYS.profile(lang));

export function parseLearnerProfile(raw: string): LearnerProfile {
  const v = readVersioned(raw, VERSION);
  const about = typeof v?.about === "string" ? v.about.slice(0, COACH_LIMITS.about) : "";
  const assessments: DatedAssessment[] = [];
  for (const a of Array.isArray(v?.assessments) ? v.assessments : []) {
    const parsed = parseAssessment(a);
    const date = parsed && (a as { date?: unknown }).date;
    if (parsed && typeof date === "string") assessments.push({ ...parsed, date: date.slice(0, 40) });
  }
  return { about, assessments: assessments.slice(0, MAX_ASSESSMENTS) };
}

export function getLearnerProfile(lang: string): LearnerProfile {
  if (typeof window === "undefined") return parseLearnerProfile("");
  return parseLearnerProfile(readProfileRaw(lang));
}

function saveProfile(lang: string, profile: LearnerProfile): boolean {
  return writeJson(COACH_KEYS.profile(lang), { v: VERSION, ...profile });
}

/** Saves the "Sobre mí" notes (trimmed, cut at the limit). */
export function setAbout(lang: string, about: string): boolean {
  return saveProfile(lang, { ...getLearnerProfile(lang), about: about.trim().slice(0, COACH_LIMITS.about) });
}

/** Stores a finished interview's assessment as the latest one. */
export function saveAssessment(lang: string, assessment: CoachAssessment): boolean {
  const profile = getLearnerProfile(lang);
  const dated: DatedAssessment = { ...assessment, date: new Date().toISOString() };
  return saveProfile(lang, { ...profile, assessments: [dated, ...profile.assessments].slice(0, MAX_ASSESSMENTS) });
}

export function clearAssessments(lang: string): boolean {
  return saveProfile(lang, { ...getLearnerProfile(lang), assessments: [] });
}

/** Learner context for the server: progress numbers, latest assessment and notes (omitted when empty). */
export function buildLearnerContext(lang: string): LearnerContext {
  const pack = getPack(lang);
  const progress = getProgress(lang);
  const lessons = getAllLessons(pack);
  const placed = lessons.filter((l) => progress.lessons[l.id]?.placement).length;
  const { about, assessments } = getLearnerProfile(lang);
  const latest = assessments[0];
  return {
    progress: {
      lessonsDone: lessons.filter((l) => l.id in progress.lessons).length,
      lessonsTotal: lessons.length,
      wordsLearned: wordsLearned(progress, pack),
      xp: progress.xp,
      placement: progress.placementAt
        ? `Prueba de nivel del ${dayKey(new Date(progress.placementAt))} (lecciones dadas por sabidas: ${placed})`
        : null,
    },
    ...(latest ? { assessment: latest } : {}),
    ...(about ? { about } : {}),
  };
}
