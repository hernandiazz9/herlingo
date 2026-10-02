"use client";

import Link from "next/link";
import { Card } from "@/components/ui";
import { cn } from "@/lib/cn";
import { DEFAULT_LANG } from "@/lib/content";
import { LEAGUE_PATH } from "@/lib/league/config";
import { useLeagueGroup } from "@/lib/league/groups";
import { dismissLeagueInvite, useLeagueInviteDismissed } from "@/lib/league/invite-dismiss";
import { useLeaderboard } from "@/lib/league/leaderboard";
import { useLeagueAccount } from "@/lib/league/use-league-account";

const BOX = "min-h-[6.25rem]";

/**
 * Ruta entry point to Liga. Nothing when Liga is not configured. Joined: weekly rank and XP (from
 * the cached board, refreshed in the background; never blocks offline). Not joined: a dismissible
 * invite. A placeholder of the same height holds the place while the account is read.
 */
export function RutaLeagueCard({ lang = DEFAULT_LANG }: { lang?: string }) {
  const account = useLeagueAccount(lang);
  const dismissed = useLeagueInviteDismissed();

  if (account.status === "disabled") return null;
  if (account.status === "loading") return <div aria-hidden="true" className={cn(BOX, "rounded-card bg-sand")} />;
  if (account.status === "joined") return <JoinedCard lang={lang} />;
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
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </Card>
  );
}

function JoinedCard({ lang }: { lang: string }) {
  const group = useLeagueGroup(lang);
  const inGroup = group.status === "ready" && group.group !== null;
  const scope = inGroup ? "group" : "global";
  const { board, loading } = useLeaderboard(lang, scope, true);
  const me = board?.rows.find((r) => r.isMe);
  const where = inGroup && group.group ? group.group.name : "la clasificación global";

  return (
    <Link
      href={LEAGUE_PATH}
      className={cn(
        BOX,
        "pressable flex flex-col justify-center gap-1 rounded-card border-2 border-line bg-surface p-4 [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep",
      )}
    >
      <span className="text-sm font-bold uppercase tracking-wider text-sea-deep">🏆 Liga · esta semana</span>
      {me ? (
        <>
          <span className="text-xl font-extrabold text-ink">
            Puesto {me.rank} · {me.weeklyXp.toLocaleString("es-ES")} XP
          </span>
          <span className="truncate text-sm text-ink-muted">En {where}</span>
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
