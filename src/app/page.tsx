import { ComingSoon } from "@/components/shell/ComingSoon";
import { PageHeader } from "@/components/shell/PageHeader";
import { Button, Card, ProgressBar } from "@/components/ui";
import { getTab } from "@/lib/navigation";

const tab = getTab("path");

export default function PathPage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Lecciones cortas, de unos 5 minutos, por situaciones del viaje." />
      <Card className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold uppercase tracking-wider text-terracotta-deep">Tu progreso</p>
          <p className="text-lg font-bold">Aún no has empezado ninguna lección.</p>
        </div>
        <ProgressBar value={0} label="Progreso de la ruta" />
        <Button fullWidth disabled>
          Empezar
        </Button>
      </Card>
      <ComingSoon>Aquí verás tus unidades y lecciones, una detrás de otra.</ComingSoon>
    </>
  );
}
