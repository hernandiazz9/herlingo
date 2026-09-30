/**
 * Stories (Historias): done state on the device, key word highlighting and the story games.
 *
 *   import { buildStoryGames, segmentStory, useStoriesDone, markStoryDone } from "@/lib/stories";
 */
export { markStoryDone, parseStoriesDone, useStoriesDone, type StoriesDone, type StoryDone } from "./done";
export { buildStoryGames, storyXp, XP_STORY, type OrderStep, type StoryGame, type StoryGameId, type StoryStep } from "./games";
export { segmentStory, type Segment } from "./highlight";

/** Link to a story page (trailing slash: static export). */
export function storyHref(id: string): string {
  return `/historias/${encodeURIComponent(id)}/`;
}
