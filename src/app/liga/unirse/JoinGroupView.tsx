"use client";

import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ConfirmDialog } from "@/components/league/ConfirmDialog";
import { JoinFlow } from "@/components/league/JoinFlow";
import { leagueErrorMessage, membersLabel } from "@/components/league/copy";
import { Button, Card } from "@/components/ui";
import {
  isGroupCode,
  joinLeagueGroup,
  normalizeGroupCode,
  rememberGroupInvite,
  switchLeagueGroup,
  useLeagueGroup,
  type LeagueGroup,
} from "@/lib/league/groups";
import { useLeagueAccount } from "@/lib/league/use-league-account";

const LINK =
  "pressable inline-flex min-h-12 items-center justify-center rounded-button border-2 border-line bg-surface px-5 text-base font-bold text-sea [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep";

const noSubscribe = () => () => {};

/** `?codigo=` of the URL, normalized; `undefined` until read on the client (static export). */
function useInviteCode(): string | null | undefined {
  const raw = useSyncExternalStore(
    noSubscribe,
    () => new URLSearchParams(window.location.search).get("codigo"),
    () => undefined,
  );
  if (raw === undefined) return undefined;
  const code = normalizeGroupCode(raw ?? "");
  return isGroupCode(code) ? code : null;
}

function Skeleton() {
  return (
    <Card aria-busy="true" className="flex flex-col gap-3">
      <span className="h-6 w-2/3 rounded-full bg-line motion-safe:animate-pulse" />
      <span className="h-4 w-1/3 rounded-full bg-line motion-safe:animate-pulse" />
      <span className="sr-only">Cargando…</span>
    </Card>
  );
}

type JoinState = { kind: "idle" } | { kind: "pending" } | { kind: "error"; message: string } | { kind: "done"; group: LeagueGroup };

/**
 * `/liga/unirse/?codigo=XXXXXX`: not joined → join the Liga first, then straight into the group;
 * joined → join (or leave the current group and join this one). The code is also remembered on
 * the device, so /liga/ offers it again after an email sign-in or if the user leaves this page.
 */
export function JoinGroupView() {
  const code = useInviteCode();
  const account = useLeagueAccount();
  const group = useLeagueGroup();
  const [join, setJoin] = useState<JoinState>({ kind: "idle" });
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    if (code) rememberGroupInvite(code);
  }, [code]);

  if (code === undefined) return <Skeleton />;

  if (code === null) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-bold text-ink">Ese enlace no es válido</p>
          <p className="text-base text-ink-muted">Pide el código del grupo y escríbelo en la Liga.</p>
        </div>
        <Link href="/liga/" className={LINK}>
          Ir a la Liga
        </Link>
      </Card>
    );
  }

  const joinGroup = async () => {
    setJoin({ kind: "pending" });
    try {
      setJoin({ kind: "done", group: await joinLeagueGroup(code) });
    } catch (error) {
      setJoin({ kind: "error", message: leagueErrorMessage(error) });
    }
  };

  const codeLabel = <strong className="font-mono tracking-widest">{code}</strong>;

  if (account.status === "loading") return <Skeleton />;

  if (account.status === "none" || account.status === "offline") {
    return (
      <>
        <Card tone="sea" className="flex flex-col gap-1">
          <p className="text-lg font-bold text-ink">Te han invitado a un grupo</p>
          <p className="text-base text-ink">
            Código {codeLabel}. Primero únete a la Liga y te meteremos en el grupo.
          </p>
        </Card>
        {account.status === "offline" ? (
          <Card tone="lemon" role="status" className="text-base text-ink">
            Sin conexión. Necesitas internet para unirte.
          </Card>
        ) : null}
        <JoinFlow account={account} onJoined={() => void joinGroup()} />
      </>
    );
  }

  if (join.kind === "done") {
    return (
      <Card tone="sea" role="status" className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-bold text-ink">¡Ya estás en «{join.group.name}»!</p>
          <p className="text-base text-ink">{membersLabel(join.group.members)}. Desde ahora competís cada semana.</p>
        </div>
        <Link href="/liga/" className={LINK}>
          Ver la Liga
        </Link>
      </Card>
    );
  }

  if (join.kind === "pending") return <Skeleton />;

  const current = group.group;
  const offlineNote = account.online ? null : (
    <p role="status" className="text-base font-bold text-terracotta-deep">
      Sin conexión. Conéctate a internet para unirte.
    </p>
  );
  const errorNote =
    join.kind === "error" ? (
      <p role="alert" className="text-base font-bold text-error-deep">
        {join.message}
      </p>
    ) : null;

  if (group.status === "unknown" && account.online) return <Skeleton />;

  if (current && current.code === code) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-bold text-ink">Ya estás en «{current.name}»</p>
          <p className="text-base text-ink-muted">{membersLabel(current.members)}.</p>
        </div>
        <Link href="/liga/" className={LINK}>
          Ver la Liga
        </Link>
      </Card>
    );
  }

  if (current) {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-bold text-ink">Ya estás en «{current.name}»</p>
          <p className="text-base text-ink-muted">
            Solo puedes estar en un grupo. Para unirte al grupo {codeLabel}, sal primero del tuyo.
          </p>
        </div>
        {errorNote}
        {offlineNote}
        <Button size="md" fullWidth onClick={() => setSwitching(true)} disabled={!account.online}>
          Cambiarme a este grupo
        </Button>
        <Link href="/liga/" className={LINK}>
          Quedarme en «{current.name}»
        </Link>
        {switching ? (
          <ConfirmDialog
            title={`¿Salir de «${current.name}»?`}
            confirmLabel="Sí, cambiar de grupo"
            pendingLabel="Cambiando…"
            blockedNote={account.online ? undefined : "Sin conexión. Conéctate a internet para hacerlo."}
            onClose={() => setSwitching(false)}
            onConfirm={async () => {
              const next = await switchLeagueGroup(code);
              setSwitching(false);
              setJoin({ kind: "done", group: next });
            }}
          >
            <p>Dejarás «{current.name}» y entrarás en el grupo {code}.</p>
            {current.members === 1 ? <p>Eres el último miembro de «{current.name}»: se borrará.</p> : null}
          </ConfirmDialog>
        ) : null}
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="text-lg font-bold text-ink">Unirte al grupo</p>
        <p className="text-base text-ink-muted">Código {codeLabel}. Competiréis cada semana por la experiencia.</p>
      </div>
      {errorNote}
      {offlineNote}
      <Button size="md" fullWidth onClick={joinGroup} disabled={!account.online}>
        Unirme al grupo
      </Button>
    </Card>
  );
}
