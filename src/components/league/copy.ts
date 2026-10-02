/**
 * Liga UI helpers: Spain Spanish copy for `LeagueError` codes, the client-side nickname check
 * (mirrors `league_set_profile`, docs/league.md → "Nicknames") and shared class strings.
 */
import { isLeagueError, type LeagueErrorCode } from "@/lib/league/errors";
import { GROUP_NAME_MAX } from "@/lib/league/groups";

export const NICKNAME_MIN = 3;
export const NICKNAME_MAX = 20;

const NICKNAME_CHARS = /^[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñÀÈÌÒÙàèìòùÇç _.-]+$/;
const NICKNAME_ALNUM = /[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñÀÈÌÒÙàèìòùÇç]/;

/** Trims and collapses inner spaces, as the server does before checking and saving. */
export function cleanNickname(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

/** Length in characters (code points), like Postgres `char_length`. */
export function nicknameLength(raw: string): number {
  return [...cleanNickname(raw)].length;
}

/** What is wrong with a nickname before asking the server, or null when it looks fine. */
export function nicknameProblem(raw: string): string | null {
  const value = cleanNickname(raw);
  const length = [...value].length;
  if (length === 0) return "Escribe un apodo.";
  if (length < NICKNAME_MIN) return `Mínimo ${NICKNAME_MIN} caracteres.`;
  if (length > NICKNAME_MAX) return `Máximo ${NICKNAME_MAX} caracteres.`;
  if (!NICKNAME_CHARS.test(value)) return "Solo letras, números, espacios y _ . -";
  if (!NICKNAME_ALNUM.test(value)) return "Pon al menos una letra o un número.";
  return null;
}

/** What is wrong with a group name before asking the server, or null when it looks fine. */
export function groupNameProblem(raw: string): string | null {
  const length = [...raw.trim().replace(/\s+/g, " ")].length;
  if (length === 0) return "Escribe un nombre para el grupo.";
  if (length > GROUP_NAME_MAX) return `Máximo ${GROUP_NAME_MAX} caracteres.`;
  return null;
}

/** "1 miembro", "4 miembros". */
export function membersLabel(count: number): string {
  return `${count} ${count === 1 ? "miembro" : "miembros"}`;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Same shape check as the account layer, to answer before sending anything. */
export function emailLooksValid(raw: string): boolean {
  return EMAIL.test(raw.trim());
}

const MESSAGES: Partial<Record<LeagueErrorCode, string>> = {
  nickname_invalid: "Usa de 3 a 20 letras, números, espacios, _ . o -.",
  nickname_blocked: "Ese apodo no está permitido. Prueba otro.",
  nickname_taken: "Ese apodo ya está cogido. Prueba otro.",
  emoji_invalid: "Elige un emoji de la lista.",
  offline: "Sin conexión. Conéctate a internet y vuelve a intentarlo.",
  network: "No hemos podido conectar. Vuelve a intentarlo en un momento.",
  disabled: "La Liga no está disponible en esta versión de la app.",
  not_joined: "Primero únete a la Liga.",
  not_authenticated: "Se ha cerrado tu sesión. Recarga la página y vuelve a intentarlo.",
  no_profile: "Primero únete a la Liga.",
  anonymous_disabled: "Ahora mismo la Liga no admite jugadores nuevos. Prueba más tarde.",
  email_invalid: "Revisa el email: parece que no está bien escrito.",
  email_taken: "Ese email ya está vinculado a otra cuenta de la Liga.",
  email_not_found: "No hay ninguna cuenta de la Liga con ese email.",
  email_not_authorized: "Por ahora no podemos enviar emails a esa dirección.",
  rate_limited: "Demasiados intentos. Espera unos minutos y vuelve a probar.",
  link_expired: "Ese enlace ha caducado o ya se usó.",
  link_invalid: "No hemos podido usar ese enlace.",
  group_name_invalid: "Usa de 1 a 30 caracteres para el nombre del grupo.",
  group_name_blocked: "Ese nombre de grupo no está permitido. Prueba otro.",
  already_in_group: "Ya estás en un grupo. Sal de él para crear o unirte a otro.",
  group_not_found: "No hay ningún grupo con ese código. Revísalo.",
  try_again: "No hemos podido crear el grupo. Vuelve a intentarlo.",
};

/** Copy for any error thrown by the league layer (falls back to a generic message). */
export function leagueErrorMessage(error: unknown): string {
  const code = isLeagueError(error) ? error.code : undefined;
  return (code && MESSAGES[code]) ?? "Algo ha fallado. Vuelve a intentarlo.";
}

/** Text field: 16px text (no zoom on iOS), token colours, error border via aria-invalid. */
export const INPUT =
  "min-h-12 w-full rounded-button border-2 border-line bg-surface px-4 text-base text-ink outline-none placeholder:text-ink-muted focus:border-sea aria-[invalid=true]:border-error disabled:opacity-60";

/** Destructive button (same as Perfil's "Borrar mi progreso"). */
export const DANGER =
  "pressable inline-flex items-center justify-center rounded-button border-2 border-error bg-surface px-5 font-bold tracking-wide text-error-deep [--ledge:var(--error-ledge)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep disabled:cursor-not-allowed disabled:opacity-50";

/** Quiet text button (links inside cards). */
export const TEXT_BUTTON =
  "inline-flex min-h-11 items-center self-start rounded-button px-1 text-base font-bold text-sea underline-offset-4 hover:underline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep disabled:cursor-not-allowed disabled:opacity-50";
