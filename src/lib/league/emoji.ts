/**
 * Liga avatars: the fixed emoji list, same items and order as the server's `league.emojis`
 * (docs/league.md → "Nicknames, emojis, group names"). The server compares with U+FE0F variation
 * selectors removed, so the list is written without them. Framework-free.
 */
export const LEAGUE_EMOJIS = [
  "🍋",
  "🍊",
  "🍕",
  "🍝",
  "🍦",
  "🥐",
  "☕",
  "🫒",
  "🐢",
  "🐬",
  "🐙",
  "🦀",
  "🐟",
  "🦊",
  "🐱",
  "🐶",
  "🐼",
  "🦁",
  "🐸",
  "🦉",
  "🐝",
  "🌋",
  "⛵",
  "🌞",
] as const;

export type LeagueEmoji = (typeof LEAGUE_EMOJIS)[number];

/** Removes U+FE0F variation selectors (as the server does) so "☕️" and "☕" compare equal. */
export function normalizeEmoji(emoji: string): string {
  return emoji.replace(/\uFE0F/g, "");
}

/** True when `emoji` is one of the avatars (ignoring variation selectors). */
export function isLeagueEmoji(emoji: string): emoji is LeagueEmoji {
  return (LEAGUE_EMOJIS as readonly string[]).includes(normalizeEmoji(emoji));
}
