import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";
import { PageHeader } from "@/components/shell/PageHeader";
import { getTab } from "@/lib/navigation";

const tab = getTab("review");

export const metadata: Metadata = { title: tab.title };

export default function ReviewPage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Repasa lo que fallas o estás a punto de olvidar." />
      <ComingSoon tone="sea">Todavía no tienes nada que repasar. Cuando hagas lecciones, lo verás aquí.</ComingSoon>
    </>
  );
}
