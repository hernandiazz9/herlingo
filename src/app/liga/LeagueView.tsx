"use client";

import { ComingSoon } from "@/components/shell/ComingSoon";
import { Card } from "@/components/ui";
import { useLeagueAccount } from "@/lib/league/use-league-account";

/**
 * Liga screen skeleton (T34): account state only. The join flow and account section (T36), groups
 * (T37) and rankings (T38) replace the placeholders.
 */
export function LeagueView() {
  const account = useLeagueAccount();

  return (
    <>
      {account.linkError ? (
        <Card tone="terracotta" role="alert" className="flex flex-col gap-1">
          <p className="text-base font-bold text-ink">
            {account.linkError.code === "link_expired"
              ? "Ese enlace ha caducado o ya se usó."
              : "No hemos podido usar ese enlace."}
          </p>
          <p className="text-base text-ink-muted">Pide uno nuevo y ábrelo en este dispositivo.</p>
        </Card>
      ) : null}

      {account.status === "loading" ? (
        <Card aria-busy="true" className="flex items-center gap-4">
          <span className="size-12 rounded-full bg-line motion-safe:animate-pulse" />
          <span className="h-5 flex-1 rounded-full bg-line motion-safe:animate-pulse" />
          <span className="sr-only">Cargando…</span>
        </Card>
      ) : null}

      {account.status === "offline" ? (
        <Card className="flex flex-col gap-1">
          <p className="text-lg font-bold text-ink">Sin conexión</p>
          <p className="text-base text-ink-muted">Conéctate a internet para unirte a la Liga.</p>
        </Card>
      ) : null}

      {account.status === "none" ? (
        <ComingSoon>Pronto podrás elegir un apodo y un emoji para unirte a la Liga.</ComingSoon>
      ) : null}

      {account.status === "joined" && account.profile ? (
        <Card className="flex items-center gap-4">
          <span aria-hidden="true" className="text-4xl leading-none">
            {account.profile.emoji}
          </span>
          <div className="flex min-w-0 flex-col">
            <p className="truncate text-lg font-bold text-ink">{account.profile.nickname}</p>
            <p className="text-sm text-ink-muted">
              {account.online ? "Ya estás en la Liga." : "Ya estás en la Liga · sin conexión"}
            </p>
          </div>
        </Card>
      ) : null}
    </>
  );
}
