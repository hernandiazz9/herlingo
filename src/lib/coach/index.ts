/**
 * Prepárate client layer (framework-free). React hooks: `@/lib/coach/use-coach`.
 *
 *   import { generatePack, savePack, packLine, toCoachApiError } from "@/lib/coach";
 *   const { pack } = await generatePack(lang, description);    // learner context added
 *   savePack(pack);                                            // "Mis situaciones" + audio cache
 *   speak(packLine(pack, pack.keyPhrases[0].text), { lang: pack.lang });  // @/lib/audio
 *
 * Storage keys `lang-lern:coach:*` (./store.ts). Errors: `CoachApiError` with `kind` offline |
 * unauthorized | limit | failed | aborted | other, a server `code` (`unknown_pack`, `tts_limit`…)
 * and a Spanish `message` to show as is.
 */
export {
  checkAccessCode,
  canRefine,
  COACH_API_BASE,
  CoachApiError,
  fetchSpeech,
  fetchUsage,
  generatePack,
  interviewStep,
  refinePack,
  toCoachApiError,
  updateMonthlyCap,
  type CoachErrorKind,
} from "./api";
export { clearAccessCode, getAccessCode, setAccessCode } from "./access";
export { cachePackAudio, coachVoices, packLine, packPlayables, questionPlayable } from "./audio";
export { deletePack, getSavedPack, getSavedPacks, pruneCoachAudio, replacePack, savePack } from "./packs";
export { awardPracticeXp, packDialogue } from "./practice";
export {
  buildLearnerContext,
  clearAssessments,
  getLearnerProfile,
  saveAssessment,
  setAbout,
  type LearnerProfile,
} from "./profile";
export { COACH_KEYS, COACH_PREFIX } from "./store";
export { formatUsd, getStoredUsage, type StoredUsage } from "./usage";
export * from "./types";
