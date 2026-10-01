"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { emailLooksValid, INPUT, leagueErrorMessage } from "./copy";

export interface EmailFormProps {
  label: string;
  submitLabel: string;
  initialEmail?: string;
  /** Sends the magic link. Throws `LeagueError`. */
  onSubmit: (email: string) => Promise<void>;
  /** Called with the address once the link was sent. */
  onSent: (email: string) => void;
  onCancel?: () => void;
  online: boolean;
}

/** Email field + "send link" button with validation, offline note and server errors. */
export function EmailForm({ label, submitLabel, initialEmail = "", onSubmit, onSent, onCancel, online }: EmailFormProps) {
  const id = useId();
  const [email, setEmail] = useState(initialEmail);
  const [showInvalid, setShowInvalid] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invalid = !emailLooksValid(email);
  const message = error ?? (showInvalid && invalid ? "Revisa el email: parece que no está bien escrito." : null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!online || pending) return;
    if (invalid) {
      setShowInvalid(true);
      return;
    }
    const address = email.trim();
    setPending(true);
    setError(null);
    try {
      await onSubmit(address);
      onSent(address);
    } catch (err) {
      setError(leagueErrorMessage(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-email`} className="text-base font-bold text-ink">
          {label}
        </label>
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="send"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          onBlur={() => setShowInvalid(email.trim() !== "")}
          placeholder="tu@email.com"
          aria-invalid={message !== null}
          aria-describedby={`${id}-msg`}
          className={INPUT}
        />
        <p
          id={`${id}-msg`}
          aria-live="polite"
          className={cn("text-sm font-bold", message ? "text-error-deep" : "sr-only")}
        >
          {message ?? ""}
        </p>
      </div>
      {!online ? (
        <p role="status" className="text-base font-bold text-terracotta-deep">
          Sin conexión. Conéctate a internet para enviar el enlace.
        </p>
      ) : null}
      <Button type="submit" size="md" fullWidth disabled={!online || pending} aria-busy={pending}>
        {pending ? "Enviando…" : submitLabel}
      </Button>
      {onCancel ? (
        <Button variant="secondary" size="md" fullWidth onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
      ) : null}
    </form>
  );
}
