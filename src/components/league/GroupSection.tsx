"use client";

import { useState } from "react";
import { Button, Card } from "@/components/ui";
import {
  createLeagueGroup,
  forgetGroupInvite,
  groupShareUrl,
  joinLeagueGroup,
  leaveLeagueGroup,
  useLeagueGroups,
  type LeagueGroup,
} from "@/lib/league/groups";
import type { UseLeagueAccount } from "@/lib/league/use-league-account";
import { ConfirmDialog } from "./ConfirmDialog";
import { leagueErrorMessage, membersLabel, TEXT_BUTTON } from "./copy";
import { CreateGroupForm, JoinGroupForm } from "./GroupForms";

export interface GroupSectionProps {
  account: UseLeagueAccount;
}

/** "Tus grupos": every group (code, share, leave), a pending invite, and create / join by code. */
export function GroupSection({ account }: GroupSectionProps) {
  const state = useLeagueGroups();
  const ready = state.status === "ready";
  const atLimit = state.groups.length >= state.maxGroups;
  const invite = state.invite && !state.groups.some((g) => g.code === state.invite) ? state.invite : null;

  return (
    <section aria-labelledby="league-group-title" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="league-group-title" className="text-2xl font-extrabold tracking-tight text-ink">
          Tus grupos
        </h2>
        {ready && state.groups.length > 0 ? (
          <p className="text-sm font-bold text-ink-muted">
            {state.groups.length} de {state.maxGroups}
          </p>
        ) : null}
      </div>
      {!ready ? (
        account.online ? (
          <Card aria-busy="true" className="flex flex-col gap-3">
            <span className="h-6 w-2/3 rounded-full bg-line motion-safe:animate-pulse" />
            <span className="h-4 w-1/3 rounded-full bg-line motion-safe:animate-pulse" />
            <span className="sr-only">Cargando tus grupos…</span>
          </Card>
        ) : (
          <Card tone="lemon" role="status" className="text-base text-ink">
            Sin conexión. Conéctate a internet para ver tus grupos.
          </Card>
        )
      ) : (
        <>
          {invite ? <InviteCard code={invite} online={account.online} atLimit={atLimit} /> : null}
          {state.groups.length > 0 ? (
            <ul className="flex flex-col gap-3" aria-label="Tus grupos">
              {state.groups.map((group) => (
                <li key={group.code}>
                  <GroupCard group={group} online={account.online} />
                </li>
              ))}
            </ul>
          ) : null}
          <AddGroup
            online={account.online}
            atLimit={atLimit}
            maxGroups={state.maxGroups}
            empty={state.groups.length === 0}
          />
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
  const details = [membersLabel(group.members), group.rank !== null ? `puesto ${group.rank} esta semana` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="break-words text-xl font-extrabold text-ink">{group.name}</p>
          <p className="text-sm text-ink-muted">{details}</p>
        </div>
        <p className="shrink-0 rounded-button bg-sand px-2 py-1 text-right">
          <span className="block text-xs font-bold text-ink-muted">Código</span>
          <span
            className="font-mono text-base font-extrabold tracking-widest text-ink"
            aria-label={group.code.split("").join(" ")}
          >
            {group.code}
          </span>
        </p>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button variant="secondary" size="md" onClick={async () => setShare(await shareGroup(group))}>
          Compartir enlace
        </Button>
        <button type="button" className={TEXT_BUTTON} onClick={() => setLeaving(true)}>
          Salir
          <span className="sr-only"> de «{group.name}»</span>
        </button>
      </div>
      {share === "copied" ? (
        <p role="status" className="text-sm font-bold text-ink">
          Enlace copiado. Pégalo en un mensaje a tus amigos.
        </p>
      ) : share === "failed" ? (
        <p role="status" className="break-all text-sm text-ink">
          Copia este enlace: <strong>{groupShareUrl(group.code)}</strong>
        </p>
      ) : null}

      {leaving ? (
        <ConfirmDialog
          title={`¿Salir de «${group.name}»?`}
          confirmLabel="Sí, salir del grupo"
          pendingLabel="Saliendo…"
          blockedNote={online ? undefined : "Sin conexión. Conéctate a internet para hacerlo."}
          onClose={() => setLeaving(false)}
          onConfirm={async () => {
            await leaveLeagueGroup(group.code);
            setLeaving(false);
          }}
        >
          <p>Dejarás de ver su clasificación. Sigues en tus otros grupos y en la general.</p>
          {group.members === 1 ? (
            <p>Eres el último miembro: el grupo se borrará y su código dejará de funcionar.</p>
          ) : (
            <p>Puedes volver cuando quieras con el código {group.code}.</p>
          )}
        </ConfirmDialog>
      ) : null}
    </Card>
  );
}

/** Invite code kept from a link opened before joining (or before signing in by email). */
function InviteCard({ code, online, atLimit }: { code: string; online: boolean; atLimit: boolean }) {
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
      ) : atLimit ? (
        <p role="status" className="text-sm font-bold text-ink">
          Ya estás en el máximo de grupos. Sal de uno para unirte a este.
        </p>
      ) : null}
      {atLimit ? null : (
        <Button size="md" fullWidth onClick={join} disabled={!online || pending} aria-busy={pending}>
          {pending ? "Uniéndote…" : "Unirme al grupo"}
        </Button>
      )}
      <button type="button" className={TEXT_BUTTON} onClick={forgetGroupInvite} disabled={pending}>
        Ahora no
      </button>
    </Card>
  );
}

function AddGroup({
  online,
  atLimit,
  maxGroups,
  empty,
}: {
  online: boolean;
  atLimit: boolean;
  maxGroups: number;
  empty: boolean;
}) {
  const [form, setForm] = useState<"create" | "join" | null>(null);

  if (atLimit) {
    return (
      <Card tone="lemon" role="status" className="text-base text-ink">
        Ya estás en {maxGroups} grupos, el máximo. Sal de uno para crear o unirte a otro.
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-4">
      <p className="text-base text-ink-muted">
        {empty
          ? `Crea un grupo para competir con tus amigos cada semana, o únete al suyo con su código. Puedes estar en hasta ${maxGroups} grupos.`
          : "¿Otro grupo? Crea uno nuevo o únete con un código: sigues en los que ya tienes."}
      </p>
      {form === "create" ? (
        <CreateGroupForm
          online={online}
          onSubmit={createLeagueGroup}
          onDone={() => setForm(null)}
          onCancel={() => setForm(null)}
        />
      ) : form === "join" ? (
        <JoinGroupForm
          online={online}
          onSubmit={joinLeagueGroup}
          onDone={() => setForm(null)}
          onCancel={() => setForm(null)}
        />
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
