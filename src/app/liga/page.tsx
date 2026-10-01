import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui";
import { leagueEnabled } from "@/lib/league/config";
import { getTab } from "@/lib/navigation";
import { LeagueView } from "./LeagueView";

const tab = getTab("league");

export const metadata: Metadata = { title: tab.title };

export default function LeaguePage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Compite con tus amigos por la experiencia de la semana." />
      {/* Env vars are inlined at build time: without them the page is static and needs no JS. */}
      {leagueEnabled() ? (
        <LeagueView />
      ) : (
        <Card className="flex flex-col gap-1">
          <p className="text-lg font-bold text-ink">La Liga no está disponible</p>
          <p className="text-base text-ink-muted">Esta versión de la app no tiene la Liga activada.</p>
        </Card>
      )}
    </>
  );
}
