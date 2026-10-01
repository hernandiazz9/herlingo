"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import {
  createLeagueGroup,
  forgetGroupInvite,
  groupShareUrl,
  joinLeagueGroup,
  leaveLeagueGroup,
  useLeagueGroup,
  type LeagueGroup,
} from "@/lib/league/groups";
import type { UseLeagueAccount } from "@/lib/league/use-league-account";
import { ConfirmDialog } from "./ConfirmDialog";
import { leagueErrorMessage, membersLabel, TEXT_BUTTON } from "./copy";
import { CreateGroupForm, JoinGroupForm } from "./GroupForms";

export interface GroupSectionProps {
  account: UseLeagueAccount;
}

/** Joined: your group (code, share, leave) or, without one, create / join by code. */
export function GroupSection({ account }: GroupSectionProps) {
  const state = useLeagueGroup();

  return (
    <section aria-labelledby="league-group-title" className="flex flex-col gap-3">
      <h2 id="league-group-title" className="text-2xl font-extrabold tracking-tight text-ink">
        Tu grupo
      </h2>
      {state.status === "unknown" ? (
        account.online ? (
          <Card aria-busy="true" className="flex flex-col gap-3">
            <span className="h-6 w-2/3 rounded-full bg-line motion-safe:animate-pulse" />
            <span className="h-4 w-1/3 rounded-full bg-line motion-safe:animate-pulse" />
            <span className="sr-only">Cargando tu grupo…</span>
          </Card>
        ) : (
          <Card tone="lemon" role="status" className="text-base text-ink">
            Sin conexión. Conéctate a internet para ver tu grupo.
          </Card>
        )
      ) : state.group ? (
        <GroupCard group={state.group} online={account.online} />
      ) : (
        <>
          {state.invite ? <InviteCard code={state.invite} online={account.online} /> : null}
          <NoGroup online={account.online} />
        </>
      )}
    </section>
  );
}

type ShareState = "idle" | "copied" | "failed";

/** Web Share when available, else copy the link. */
async function shareGroup(group: LeagueGroup): Promise<ShareState> {
  const url = groupShareUrl(group.code);
  const text = `Únete a mi grupo «${group.name}» en la Liga con el código ${group.code}`;
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: "Liga", text, url });
      return "idle";
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return "idle";
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}

function GroupCard({ group, online }: { group: LeagueGroup; online: boolean }) {
  const [share, setShare] = useState<ShareState>("idle");
  const [leaving, setLeaving] = useState(false);

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="break-words text-xl font-extrabold text-ink">{group.name}</p>
        <p className="text-sm text-ink-muted">{membersLabel(group.members)}</p>
      </div>
      <div className="flex flex-col items-center gap-1 rounded-button bg-sand px-4 py-3">
        <p className="text-sm font-bold text-ink-muted">Código para unirse</p>
        <p className="font-mono text-3xl font-extrabold tracking-[0.3em] text-ink" aria-label={group.code.split("").join(" ")}>
          {group.code}
        </p>
      </div>
      <Button size="md" fullWidth onClick={async () => setShare(await shareGroup(group))}>
        Compartir enlace
      </Button>
      {share === "copied" ? (
        <p role="status" className="text-sm font-bold text-ink">
          Enlace copiado. Pégalo en un mensaje a tus amigos.
        </p>
      ) : share === "failed" ? (
        <p role="status" className="break-all text-sm text-ink">
          Copia este enlace: <strong>{groupShareUrl(group.code)}</strong>
        </p>
      ) : null}
      <button type="button" className={TEXT_BUTTON} onClick={() => setLeaving(true)}>
        Salir del grupo
      </button>

      {leaving ? (
        <ConfirmDialog
          title="¿Salir del grupo?"
          confirmLabel="Sí, salir del grupo"
          pendingLabel="Saliendo…"
          blockedNote={online ? undefined : "Sin conexión. Conéctate a internet para hacerlo."}
          onClose={() => setLeaving(false)}
          onConfirm={async () => {
            await leaveLeagueGroup();
            setLeaving(false);
          }}
        >
          <p>
            Dejarás de ver la clasificación de «{group.name}». Tu experiencia sigue contando en la global, y puedes volver
            con el código {group.code}.
          </p>
          {group.members === 1 ? <p>Eres el último miembro: el grupo se borrará.</p> : null}
        </ConfirmDialog>
      ) : null}
    </Card>
  );
}

/** Invite code kept from a link opened before joining (or before signing in by email). */
function InviteCard({ code, online }: { code: string; online: boolean }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setPending(true);
    setError(null);
    try {
      await joinLeagueGroup(code);
    } catch (err) {
      setError(leagueErrorMessage(err));
      setPending(false);
    }
  };

  return (
    <Card tone="sea" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-bold text-ink">Te han invitado a un grupo</h3>
        <p className="text-sm text-ink">
          Código <strong className="font-mono tracking-widest">{code}</strong>.
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm font-bold text-error-deep">
          {error}
        </p>
      ) : null}
      <Button size="md" fullWidth onClick={join} disabled={!online || pending} aria-busy={pending}>
        {pending ? "Uniéndote…" : "Unirme al grupo"}
      </Button>
      <button type="button" className={TEXT_BUTTON} onClick={forgetGroupInvite} disabled={pending}>
        Ahora no
      </button>
    </Card>
  );
}

function NoGroup({ online }: { online: boolean }) {
  const [form, setForm] = useState<"create" | "join" | null>(null);

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-base text-ink-muted">
        Crea un grupo para competir con tus amigos cada semana, o únete al suyo con su código. Solo puedes estar en un
        grupo.
      </p>
      {form === "create" ? (
        <CreateGroupForm online={online} onSubmit={createLeagueGroup} onCancel={() => setForm(null)} />
      ) : form === "join" ? (
        <JoinGroupForm online={online} onSubmit={joinLeagueGroup} onCancel={() => setForm(null)} />
      ) : (
        <div className="flex flex-col gap-3">
          <Button size="md" fullWidth onClick={() => setForm("create")}>
            Crear un grupo
          </Button>
          <Button variant="secondary" size="md" fullWidth onClick={() => setForm("join")}>
            Unirme con un código
          </Button>
        </div>
      )}
    </Card>
  );
}
