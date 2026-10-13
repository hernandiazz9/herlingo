/**
 * Modo deporte (docs/sport.md): audio-only episodes. The model (`./types`), the compiler
 * (`compileEpisode`, `episodePlayables`), the free episodes built on the device
 * (`episodeFromDialogue`, `episodeFromRoute`), the joined mp3 (`prepareEpisode`, `joinEpisodes`,
 * `episodeMp3File`) and its player (`episodePlayer`).
 */
export { compileEpisode, DIALOGUE_LINES_FROM_CONTENT, episodePlayables } from "./compile";
export {
  episodePlayer,
  RESTART_WINDOW_SEC,
  type EpisodePlayerMeta,
  type EpisodePlayerState,
} from "./player";
export {
  EpisodeAudioError,
  episodeMp3File,
  joinEpisodes,
  prepareEpisode,
  type EpisodeAudioErrorCode,
  type PreparedChapter,
  type PreparedEpisode,
  type PrepareOptions,
  type PrepareProgress,
} from "./prepare";
export { EPISODE_GAPS, NARRATION, narrationCopy, type NarrationCopy } from "./narration";
export { dialogueEpisodeId, episodeFromDialogue, episodeFromRoute, MAX_VARIANTS, routeEpisodeId } from "./sources";
export type * from "./types";
