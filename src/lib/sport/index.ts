/**
 * Modo deporte (docs/sport.md): audio-only episodes. The model (`./types`), the compiler
 * (`compileEpisode`, `episodePlayables`) and the free episodes built on the device
 * (`episodeFromDialogue`, `episodeFromRoute`).
 */
export { compileEpisode, episodePlayables } from "./compile";
export { EPISODE_GAPS, NARRATION, narrationCopy, type NarrationCopy } from "./narration";
export { dialogueEpisodeId, episodeFromDialogue, episodeFromRoute, MAX_VARIANTS, routeEpisodeId } from "./sources";
export type * from "./types";
