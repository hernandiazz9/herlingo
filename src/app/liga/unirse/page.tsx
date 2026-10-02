import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui";
import { leagueEnabled } from "@/lib/league/config";
import { getTab } from "@/lib/navigation";
import { JoinGroupView } from "./JoinGroupView";

const tab = getTab("league");

export const metadata: Metadata = { title: `Unirse a un grupo · ${tab.title}` };

export default function JoinGroupPage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Te han invitado a un grupo de la Liga." />
      {leagueEnabled() ? (
        <JoinGroupView />
      ) : (
        <Card className="flex flex-col gap-1">
          <p className="text-lg font-bold text-ink">La Liga no está disponible</p>
          <p className="text-base text-ink-muted">Esta versión de la app no tiene la Liga activada.</p>
        </Card>
      )}
    </>
  );
}
