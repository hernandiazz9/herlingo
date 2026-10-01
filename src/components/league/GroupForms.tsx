"use client";

import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import { GROUP_CODE_LENGTH, GROUP_NAME_MAX, isGroupCode, normalizeGroupCode, type LeagueGroup } from "@/lib/league/groups";
import { groupNameProblem, INPUT, leagueErrorMessage } from "./copy";

const OFFLINE = "Sin conexión. Conéctate a internet para hacerlo.";

interface FieldFormProps {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  problem: string | null;
  showProblem: boolean;
  onBlur: () => void;
  error: string | null;
  submitLabel: string;
  pendingLabel: string;
  pending: boolean;
  online: boolean;
  onSubmit: (event: FormEvent) => void;
  onCancel?: () => void;
  input: "name" | "code";
}

/** One text field + submit/cancel with validation, offline note and server error. */
function FieldForm(props: FieldFormProps) {
  const id = useId();
  const message = props.error ?? (props.showProblem ? props.problem : null);
  return (
    <form onSubmit={props.onSubmit} noValidate className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-field`} className="text-base font-bold text-ink">
          {props.label}
        </label>
        <input
          id={`${id}-field`}
          type="text"
          value={props.value}
          onChange={(e) => props.onChange(e.target.value)}
          onBlur={props.onBlur}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          {...(props.input === "code"
            ? { autoCapitalize: "characters", maxLength: GROUP_CODE_LENGTH + 2, placeholder: "K7PX2M" }
            : { autoCapitalize: "sentences", maxLength: GROUP_NAME_MAX + 10, placeholder: "Amici" })}
          aria-invalid={message !== null}
          aria-describedby={`${id}-msg`}
          className={cn(INPUT, props.input === "code" && "font-mono text-xl tracking-[0.3em] uppercase")}
        />
        <p id={`${id}-msg`} aria-live="polite" className={cn("text-sm", message ? "font-bold text-error-deep" : "text-ink-muted")}>
          {message ?? props.hint}
        </p>
      </div>
      {!props.online ? (
        <p role="status" className="text-base font-bold text-terracotta-deep">
          {OFFLINE}
        </p>
      ) : null}
      <Button type="submit" size="md" fullWidth disabled={!props.online || props.pending} aria-busy={props.pending}>
        {props.pending ? props.pendingLabel : props.submitLabel}
      </Button>
      {props.onCancel ? (
        <Button variant="secondary" size="md" fullWidth onClick={props.onCancel} disabled={props.pending}>
          Cancelar
        </Button>
      ) : null}
    </form>
  );
}

interface GroupFormProps {
  online: boolean;
  /** Throws `LeagueError`; the message is shown under the field. */
  onSubmit: (value: string) => Promise<LeagueGroup>;
  onDone?: (group: LeagueGroup) => void;
  onCancel?: () => void;
}

function useGroupForm(check: (value: string) => string | null, { online, onSubmit, onDone }: GroupFormProps) {
  const [value, setValue] = useState("");
  const [showProblem, setShowProblem] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const problem = check(value);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!online || pending) return;
    if (problem) {
      setShowProblem(true);
      return;
    }
    setPending(true);
    setError(null);
    try {
      const group = await onSubmit(value);
      onDone?.(group);
    } catch (err) {
      setError(leagueErrorMessage(err));
      setPending(false);
    }
  };

  return {
    value,
    onChange: (next: string) => {
      setValue(next);
      setError(null);
    },
    problem,
    showProblem,
    onBlur: () => setShowProblem(value.trim() !== ""),
    error,
    pending,
    onSubmit: submit,
  };
}

function codeProblem(raw: string): string | null {
  const code = normalizeGroupCode(raw);
  if (code === "") return "Escribe el código del grupo.";
  return isGroupCode(code) ? null : `El código tiene ${GROUP_CODE_LENGTH} letras y números.`;
}

/** "Crear un grupo": name field. */
export function CreateGroupForm(props: GroupFormProps) {
  const form = useGroupForm(groupNameProblem, props);
  return (
    <FieldForm
      {...form}
      input="name"
      label="Nombre del grupo"
      hint="Lo verán los que se unan."
      submitLabel="Crear grupo"
      pendingLabel="Creando…"
      online={props.online}
      onCancel={props.onCancel}
    />
  );
}

/** "Unirme con un código": 6-character code field. */
export function JoinGroupForm(props: GroupFormProps) {
  const form = useGroupForm(codeProblem, props);
  return (
    <FieldForm
      {...form}
      input="code"
      label="Código del grupo"
      hint="Pídeselo a quien creó el grupo."
      submitLabel="Unirme al grupo"
      pendingLabel="Uniéndote…"
      online={props.online}
      onCancel={props.onCancel}
    />
  );
}
