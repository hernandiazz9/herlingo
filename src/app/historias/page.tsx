import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";
import { PageHeader } from "@/components/shell/PageHeader";
import { getTab } from "@/lib/navigation";

const tab = getTab("stories");

export const metadata: Metadata = { title: tab.title };

export default function StoriesPage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Historias cortas que siguen tu viaje, frase a frase." />
      <ComingSoon tone="sea">
        Lee cada historia frase a frase, escúchala y mira la traducción solo cuando la necesites. Al terminar,
        juega con sus palabras y expresiones.
      </ComingSoon>
    </>
  );
}
