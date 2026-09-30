import { PathView } from "@/components/path/PathView";
import { PageHeader } from "@/components/shell/PageHeader";
import { getTab } from "@/lib/navigation";

const tab = getTab("path");

export default function PathPage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Lecciones cortas, de unos 5 minutos, por situaciones del viaje." />
      <PathView />
    </>
  );
}
