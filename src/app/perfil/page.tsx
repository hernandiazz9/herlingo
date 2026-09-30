import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";
import { PageHeader } from "@/components/shell/PageHeader";
import { ThemeToggle } from "@/components/shell/ThemeToggle";
import { Card } from "@/components/ui";
import { getTab } from "@/lib/navigation";

const tab = getTab("profile");

export const metadata: Metadata = { title: tab.title };

export default function ProfilePage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Tu racha, tu experiencia y tus ajustes." />
      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-ink">Tema</h2>
          <p className="text-sm text-ink-muted">Sistema sigue el modo claro u oscuro de tu móvil.</p>
        </div>
        <ThemeToggle />
      </Card>
      <ComingSoon>Aquí verás tus puntos de experiencia (XP), los días seguidos que llevas y los ajustes.</ComingSoon>
    </>
  );
}
