"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { LEAGUE_PATH } from "@/lib/league/config";
import { useLeagueGroups } from "@/lib/league/groups";
import { dismissLeagueInvite, useLeagueInviteDismissed } from "@/lib/league/invite-dismiss";
import { useLeagueAccount } from "@/lib/league/use-league-account";

const BOX = "min-h-[6.25rem]";

/**
 * Ruta entry point to Liga. Nothing when Liga is not configured. Joined: rank in the general table
 * and weekly XP of every language (`league_status`, cached, refreshed in the background; never
 * blocks offline). Not joined: a dismissible invite. A placeholder of the same height holds the
 * place while the account is read. The Liga is the same for every language: `lang` is not used.
 */
export const RutaLeagueCard: (props: { lang?: string }) => ReactNode = () => {
  const account = useLeagueAccount();
  const dismissed = useLeagueInviteDismissed();

  if (account.status === "disabled") return null;
  if (account.status === "loading") return <div aria-hidden="true" className={cn(BOX, "rounded-card bg-sand")} />;
  if (account.status === "joined") return <JoinedCard />;
  if (account.status === "offline" || dismissed) return null;

  return (
    <Card tone="sea" className={cn(BOX, "relative flex flex-col gap-1 p-4 pr-14")}>
      <Link
        href={LEAGUE_PATH}
        className="flex flex-col gap-1 rounded-button focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-lemon-deep"
      >
        <span className="text-lg font-extrabold text-ink">🏆 Compite con tus amigos</span>
        <span className="text-sm text-ink">Crea un grupo y mira quién suma más XP cada semana.</span>
        <span className="text-sm font-bold text-sea-deep">Entrar en la Liga</span>
      </Link>
      <button
        type="button"
        aria-label="Cerrar invitación a la Liga"
        title="Cerrar"
        onClick={dismissLeagueInvite}
        className="absolute right-1 top-1 inline-flex size-11 items-center justify-center rounded-full text-ink-muted focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </Card>
  );
};

function JoinedCard() {
  const status = useLeagueGroups();
  // Past the end of the week the cached numbers belong to the last one (the refresh will replace them).
  const [now] = useState(() => Date.now());
  const thisWeek = status.status === "ready" && (status.weekEnd === null || status.weekEnd > now);
  const loading = status.status !== "ready" && status.refreshing;

  return (
    <Link
      href={LEAGUE_PATH}
      className={cn(
        BOX,
        "pressable flex flex-col justify-center gap-1 rounded-card border-2 border-line bg-surface p-4 [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
      )}
    >
      <span className="text-sm font-bold uppercase tracking-wider text-sea-deep">🏆 Liga · esta semana</span>
      {thisWeek && status.globalRank !== null ? (
        <>
          <span className="text-xl font-extrabold text-ink">
            Puesto {status.globalRank} · {status.weeklyXp.toLocaleString("es-ES")} XP
          </span>
          <span className="truncate text-sm text-ink-muted">En la general · todos los idiomas</span>
        </>
      ) : (
        <>
          <span className="text-xl font-extrabold text-ink">{loading ? "Cargando…" : "Aún sin puesto"}</span>
          <span className="text-sm text-ink-muted">
            {loading ? "Leyendo tu clasificación" : "Gana XP para entrar en la clasificación"}
          </span>
        </>
      )}
    </Link>
  );
}
