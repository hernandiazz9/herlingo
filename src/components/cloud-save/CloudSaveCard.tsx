"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card } from "@/components/ui";
import { DANGER } from "@/components/league/copy";
import { cn } from "@/lib/cn";
import {
  CLOUD_SAVE_ERRORS,
  deleteCloudCopy,
  reopenCloudPrompt,
  restoreCloudCopy,
  setCloudSaveEnabled,
  syncNow,
  UNDO_DAYS,
  type CloudSaveState,
} from "@/lib/cloud-save";
import { useCloudSave } from "@/lib/cloud-save/use-cloud-save";
import { LEAGUE_PATH } from "@/lib/league/config";
import { useLeagueAccount, type UseLeagueAccount } from "@/lib/league/use-league-account";
import { CloudConfirmDialog } from "./CloudConfirmDialog";
import { CloudUndoPanel } from "./CloudUndoPanel";
import { formatAgo, formatSize } from "./copy";

type Tone = "muted" | "ok" | "warn" | "error";
type Notice = { kind: "info" | "error"; text: string } | null;

const OFFLINE_NOTE = "Sin conexión. Conéctate a internet para hacerlo.";

const LINK =
  "pressable inline-flex min-h-12 items-center justify-center rounded-button border-2 border-line bg-surface px-5 text-center text-base font-bold text-sea [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep";

const TONES: Record<Tone, string> = {
  muted: "text-ink",
  ok: "text-success-deep",
  warn: "text-terracotta-deep",
  error: "text-error-deep",
};

/**
 * Perfil → "Guardado en la nube" (plan 010): status, size, the switch, "Guardar ahora",
 * "Restaurar desde la nube", "Borrar copia de la nube", the Liga calls to action and the undo of
 * the last cloud restore. Only mounted when Liga is configured (`CloudSaveSection` on Perfil).
 */
export function CloudSaveCard() {
  const state = useCloudSave();
  const account = useLeagueAccount();
  const now = useNow();
  const [dialog, setDialog] = useState<"restore" | "delete" | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const joined = account.status === "joined" && Boolean(account.userId);
  const checking = account.status === "loading";
  const online = account.online;
  const choosing = state.status === "conflict" || state.status === "restore-available";
  const status = statusLine(state, account, now);

  const saveNow = async () => {
    setSaving(true);
    setNotice(null);
    try {
      await syncNow();
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="cloud-save-title" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="cloud-save-title" className="text-2xl font-extrabold tracking-tight text-ink">
          Guardado en la nube
        </h2>
        <p className="text-sm text-ink-muted">
          Tu copia (progreso, situaciones guardadas de Prepárate y Sobre mí) se guarda en el servidor de la Liga, ligada a tu
          cuenta.
        </p>
      </div>
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p role="status" aria-live="polite" className={cn("text-lg font-bold", TONES[status.tone])}>
            {status.text}
          </p>
          {joined && state.enabled && state.size !== null ? (
            <p className="text-sm text-ink-muted">Tamaño de la copia: {formatSize(state.size)} (máximo 2 MB)</p>
          ) : null}
        </div>

        {choosing && state.promptDismissed ? (
          <Button size="md" onClick={reopenCloudPrompt}>
            {state.status === "conflict" ? "Elegir qué copia conservar" : "Ver la copia de la nube"}
          </Button>
        ) : null}

        {!checking && !joined ? (
          <div className="flex flex-col gap-3 rounded-card bg-sea-soft p-4">
            <p className="text-base font-bold text-ink">Crea tu cuenta en la Liga para guardar en la nube.</p>
            <Link href={LEAGUE_PATH} className={LINK}>
              Ir a la Liga
            </Link>
          </div>
        ) : null}

        {joined && account.pendingEmail ? (
          <div className="flex flex-col gap-3 rounded-card bg-sea-soft p-4">
            <p className="text-base text-ink">
              Abre el enlace que te enviamos a <strong className="break-words">{account.pendingEmail}</strong> para poder
              recuperar tu progreso en otro móvil.
            </p>
            <Link href={LEAGUE_PATH} className={LINK}>
              Ver mi cuenta de la Liga
            </Link>
          </div>
        ) : joined && state.needsEmail ? (
          <div className="flex flex-col gap-3 rounded-card bg-lemon-soft p-4">
            <p className="text-base font-bold text-ink">Vincula tu email para poder recuperar tu progreso en otro móvil.</p>
            <Link href={LEAGUE_PATH} className={LINK}>
              Vincular mi email
            </Link>
          </div>
        ) : null}

        <div className="h-0.5 bg-line" />
        <Switch
          label="Guardar en la nube"
          hint={
            state.enabled
              ? "Tus cambios se suben solos unos segundos después de hacerlos."
              : "No se sube nada. La copia que ya esté en la nube se queda allí."
          }
          checked={state.enabled}
          onChange={(on) => {
            setNotice(null);
            setCloudSaveEnabled(on);
          }}
        />

        {joined ? (
          <>
            <div className="h-0.5 bg-line" />
            <div className="flex flex-col gap-3">
              {state.enabled ? (
                <>
                  <Button
                    size="md"
                    onClick={() => void saveNow()}
                    disabled={!online || saving || choosing || state.status === "uploading"}
                    aria-busy={saving}
                  >
                    {saving || state.status === "uploading" ? "Guardando…" : "Guardar ahora"}
                  </Button>
                  <Button
                    size="md"
                    variant="secondary"
                    onClick={() => {
                      setNotice(null);
                      setDialog("restore");
                    }}
                  >
                    Restaurar desde la nube
                  </Button>
                </>
              ) : (
                <p className="text-sm text-ink-muted">Activa el guardado para guardar o restaurar tu copia.</p>
              )}
              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setDialog("delete");
                }}
                className={cn(DANGER, "min-h-12 py-2 text-base")}
              >
                Borrar copia de la nube
              </button>
            </div>
          </>
        ) : null}

        {notice?.kind === "info" ? (
          <p role="status" className="rounded-card bg-sea-soft p-4 text-base text-ink">
            {notice.text}
          </p>
        ) : null}
        {notice?.kind === "error" ? (
          <p role="alert" className="rounded-card bg-error-soft p-4 text-base font-bold text-error-deep">
            {notice.text}
          </p>
        ) : null}

        <CloudUndoPanel />
      </Card>

      {dialog === "restore" ? (
        <CloudConfirmDialog
          title="¿Restaurar la copia de la nube?"
          confirmLabel="Sí, restaurar"
          pendingLabel="Restaurando…"
          blockedNote={online ? undefined : OFFLINE_NOTE}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await restoreCloudCopy();
            setDialog(null);
            setNotice({ kind: "info", text: "Copia restaurada: ya tienes en este móvil tu progreso de la nube." });
          }}
        >
          <p>
            Lo que hay en este móvil (progreso, ajustes, situaciones de Prepárate y Sobre mí) se sustituirá por tu copia de la
            nube.
          </p>
          <p>Antes guardamos lo que tienes ahora: podrás deshacerlo durante {UNDO_DAYS} días.</p>
        </CloudConfirmDialog>
      ) : null}

      {dialog === "delete" ? (
        <CloudConfirmDialog
          title="¿Borrar la copia de la nube?"
          confirmLabel="Sí, borrar la copia"
          pendingLabel="Borrando…"
          blockedNote={online ? undefined : OFFLINE_NOTE}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            await deleteCloudCopy();
            setDialog(null);
            setNotice({ kind: "info", text: "Copia de la nube borrada. Lo que hay en este móvil sigue igual." });
          }}
        >
          <p>Borraremos tu copia del servidor de la Liga. Lo que hay en este móvil no se toca. No se puede deshacer.</p>
          <p>
            {state.enabled
              ? "El guardado en la nube sigue activado: con tu próximo cambio se creará una copia nueva. Si no quieres, desactívalo antes."
              : "El guardado está desactivado: no se subirá nada hasta que lo actives."}
          </p>
        </CloudConfirmDialog>
      ) : null}
    </section>
  );
}

/** The status line ("Guardado hace 2 min", "Pendiente: sin conexión"…) and its colour. */
function statusLine(state: CloudSaveState, account: UseLeagueAccount, now: number): { text: string; tone: Tone } {
  if (account.status === "loading") return { text: "Comprobando tu cuenta…", tone: "muted" };
  switch (state.status) {
    case "off":
      return { text: "Desactivado", tone: "muted" };
    case "no-account":
      return { text: "Sin cuenta de la Liga", tone: "muted" };
    case "idle":
      return state.lastSyncAt
        ? { text: `Guardado ${formatAgo(state.lastSyncAt, now)}`, tone: "ok" }
        : { text: "No hay copia en la nube. Se creará con tu próximo cambio.", tone: "muted" };
    case "dirty":
      return { text: "Pendiente de subir", tone: "muted" };
    case "uploading":
      return { text: "Guardando…", tone: "muted" };
    case "offline":
      return { text: "Pendiente: sin conexión", tone: "warn" };
    case "error": {
      const token = state.lastError as keyof typeof CLOUD_SAVE_ERRORS | null;
      const text = token && Object.hasOwn(CLOUD_SAVE_ERRORS, token) ? CLOUD_SAVE_ERRORS[token] : "No se ha podido guardar en la nube.";
      return { text, tone: "error" };
    }
    case "conflict":
      return { text: "Hay un conflicto: elige qué copia conservar", tone: "warn" };
    case "restore-available":
      return { text: "Tienes una copia en la nube sin restaurar", tone: "warn" };
  }
}

/** Current time, refreshed every 30 s (for "hace 2 min"). */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Switch({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex w-full items-center gap-4 text-left focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-lemon-deep"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-lg font-bold text-ink">{label}</span>
        <span className="text-sm text-ink-muted">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-8 w-14 shrink-0 rounded-full border-2 transition-colors motion-reduce:transition-none",
          checked ? "border-sea bg-sea" : "border-line bg-sand",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-6 rounded-full bg-surface shadow-[0_1px_2px_var(--shadow)] transition-[left] motion-reduce:transition-none",
            checked ? "left-[1.625rem]" : "left-0.5",
          )}
        />
      </span>
    </button>
  );
}
