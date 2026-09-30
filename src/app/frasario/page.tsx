import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";
import { PageHeader } from "@/components/shell/PageHeader";
import { getTab } from "@/lib/navigation";

const tab = getTab("phrasebook");

export const metadata: Metadata = { title: tab.title };

export default function PhrasebookPage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Las frases que necesitas en el viaje, a mano." />
      <ComingSoon tone="terracotta">
        Busca por situación, toca una frase para escucharla y enséñasela a quien tengas delante.
      </ComingSoon>
    </>
  );
}
