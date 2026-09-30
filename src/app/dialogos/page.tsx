import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";
import { PageHeader } from "@/components/shell/PageHeader";
import { getTab } from "@/lib/navigation";

const tab = getTab("dialogues");

export const metadata: Metadata = { title: tab.title };

export default function DialoguesPage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Practica conversaciones como las que vas a tener." />
      <ComingSoon tone="sea">Te hablarán, escucharás y elegirás o dirás tu respuesta.</ComingSoon>
    </>
  );
}
