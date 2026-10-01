"use client";

import { useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { LEAGUE_EMOJIS, normalizeEmoji } from "@/lib/league/emoji";
import { isLeagueError } from "@/lib/league/errors";
import { cleanNickname, INPUT, leagueErrorMessage, nicknameLength, nicknameProblem, NICKNAME_MAX } from "./copy";

export interface ProfileFormProps {
  initialNickname?: string;
  initialEmoji: string;
  submitLabel: string;
  pendingLabel: string;
  /** Saves the profile. Throws `LeagueError`; nickname errors are shown under the field. */
  onSubmit: (nickname: string, emoji: string) => Promise<void>;
  onCancel?: () => void;
  /** Device connectivity: offline disables the submit button with a note. */
  online: boolean;
  /** Disable submitting while nothing changed (editing). */
  requireChange?: boolean;
}

const COLUMNS = 6;

/** Nickname (live validation + server errors) and emoji grid, for joining and for editing. */
export function ProfileForm({
  initialNickname = "",
  initialEmoji,
  submitLabel,
  pendingLabel,
  onSubmit,
  onCancel,
  online,
  requireChange = false,
}: ProfileFormProps) {
  const id = useId();
  const [nickname, setNickname] = useState(initialNickname);
  const [emoji, setEmoji] = useState(normalizeEmoji(initialEmoji));
  const [touched, setTouched] = useState(initialNickname !== "");
  const [pending, setPending] = useState(false);
  /** Nicknames the server rejected (lower case) with the reason, so retyping one shows it at once. */
  const [rejected, setRejected] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const emojiRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const clean = cleanNickname(nickname);
  const localProblem = nicknameProblem(nickname);
  const serverProblem = rejected[clean.toLowerCase()];
  const problem = localProblem ?? serverProblem ?? null;
  const showProblem = touched && problem !== null;
  const unchanged = clean === cleanNickname(initialNickname) && emoji === normalizeEmoji(initialEmoji);
  const disabled = !online || pending || (requireChange && unchanged);
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (disabled) return;
    if (problem !== null) {
      inputRef.current?.focus();
      return;
    }
    setPending(true);
    setFormError(null);
    try {
      await onSubmit(clean, emoji);
    } catch (error) {
      if (isLeagueError(error) && error.code.startsWith("nickname_")) {
        setRejected((prev) => ({ ...prev, [clean.toLowerCase()]: leagueErrorMessage(error) }));
      } else {
        setFormError(leagueErrorMessage(error));
      }
    } finally {
      setPending(false);
    }
  };

  const onEmojiKey = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    const next = (index + step + LEAGUE_EMOJIS.length) % LEAGUE_EMOJIS.length;
    setEmoji(LEAGUE_EMOJIS[next]);
    emojiRefs.current[next]?.focus();
  };

  const nicknameId = `${id}-nickname`;
  const hintId = `${id}-hint`;
  const emojiLabelId = `${id}-emoji`;

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={nicknameId} className="text-lg font-bold text-ink">
            Tu apodo
          </label>
          <span
            aria-hidden="true"
            className={cn(
              "text-sm tabular-nums",
              nicknameLength(nickname) > NICKNAME_MAX ? "font-bold text-error-deep" : "text-ink-muted",
            )}
          >
            {nicknameLength(nickname)}/{NICKNAME_MAX}
          </span>
        </div>
        <input
          ref={inputRef}
          id={nicknameId}
          type="text"
          value={nickname}
          onChange={(e) => {
            setNickname(e.target.value);
            setTouched(true);
            setFormError(null);
          }}
          placeholder="Por ejemplo, Lucía_88"
          autoComplete="nickname"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="done"
          aria-invalid={showProblem}
          aria-describedby={hintId}
          className={INPUT}
        />
        <p id={hintId} aria-live="polite" className={cn("text-sm", showProblem ? "font-bold text-error-deep" : "text-ink-muted")}>
          {showProblem ? problem : "De 3 a 20 caracteres: letras, números, espacios y _ . -"}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <p id={emojiLabelId} className="text-lg font-bold text-ink">
          Tu emoji
        </p>
        <div role="radiogroup" aria-labelledby={emojiLabelId} className="grid grid-cols-6 gap-2">
          {LEAGUE_EMOJIS.map((item, index) => {
            const selected = item === emoji;
            return (
              <button
                key={item}
                ref={(el) => {
                  emojiRefs.current[index] = el;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={item}
                tabIndex={selected ? 0 : -1}
                onClick={() => setEmoji(item)}
                onKeyDown={(e) => onEmojiKey(e, index)}
                className={cn(
                  "pressable flex aspect-square items-center justify-center rounded-2xl border-2 text-2xl leading-none",
                  "focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
                  selected
                    ? "border-sea bg-sea-soft [--ledge:var(--sea-ledge)]"
                    : "border-line bg-surface [--ledge:var(--line)]",
                )}
              >
                <span aria-hidden="true">{item}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-button bg-sand px-4 py-3">
        <span aria-hidden="true" className="text-3xl leading-none">
          {emoji}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold uppercase tracking-wider text-ink-muted">Así te verán</span>
          <span className="block truncate text-lg font-bold text-ink">{clean || "Tu apodo"}</span>
        </span>
      </div>

      {!online ? (
        <p role="status" className="text-base font-bold text-terracotta-deep">
          Sin conexión. Conéctate a internet para guardar.
        </p>
      ) : null}
      {formError ? (
        <p role="alert" className="text-base font-bold text-error-deep">
          {formError}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        <Button type="submit" fullWidth disabled={disabled} aria-busy={pending}>
          {pending ? pendingLabel : submitLabel}
        </Button>
        {onCancel ? (
          <Button variant="secondary" size="md" fullWidth onClick={onCancel} disabled={pending}>
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
