"use client";

import { useState } from "react";
import { AccountSection } from "@/components/league/AccountSection";
import { GroupSection } from "@/components/league/GroupSection";
import { JoinFlow } from "@/components/league/JoinFlow";
import { Leaderboard } from "@/components/league/Leaderboard";
import { ProfileCard } from "@/components/league/ProfileCard";
import { leagueErrorMessage, TEXT_BUTTON } from "@/components/league/copy";
import { Card } from "@/components/ui";
import { useLeagueAccount } from "@/lib/league/use-league-account";

/**
 * The Liga screen. Not joined: join flow (nickname + emoji, or sign in with email). Joined: profile,
 * your groups, the weekly rankings (general + one per group) and the account section (email, sign out, leave and delete my data).
 */
export function LeagueView() {
  const account = useLeagueAccount();
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <>
      {account.linkError ? (
        <Card tone="terracotta" role="alert" className="flex flex-col gap-1">
          <p className="text-base font-bold text-ink">{leagueErrorMessage(account.linkError)}</p>
          <p className="text-base text-ink-muted">Pide uno nuevo y ábrelo en este dispositivo.</p>
          <button type="button" className={TEXT_BUTTON} onClick={account.clearLinkError}>
            Entendido
          </button>
        </Card>
      ) : null}

      {notice && account.status !== "joined" ? (
        <Card tone="sea" role="status" className="text-base font-bold text-ink">
          {notice}
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
        <Card tone="lemon" role="status" className="flex flex-col gap-1">
          <p className="text-lg font-bold text-ink">Sin conexión</p>
          <p className="text-base text-ink">
            Puedes elegir tu apodo y tu emoji, pero necesitas internet para unirte a la Liga.
          </p>
        </Card>
      ) : null}

      {account.status === "none" || account.status === "offline" ? <JoinFlow account={account} /> : null}

      {account.status === "joined" && account.profile ? (
        <>
          <ProfileCard profile={account.profile} account={account} />

          <GroupSection account={account} />

          <Leaderboard online={account.online} />

          <AccountSection
            account={account}
            onDeleted={() => setNotice("Has salido de la Liga y hemos borrado tus datos.")}
          />
        </>
      ) : null}
    </>
  );
}
