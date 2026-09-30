import type { Metadata } from "next";
import { ComingSoon } from "@/components/shell/ComingSoon";
import { PageHeader } from "@/components/shell/PageHeader";
import { getTab } from "@/lib/navigation";

const tab = getTab("play");

export const metadata: Metadata = { title: tab.title };

export default function PlayPage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Partidas rápidas por temas para sumar mucho vocabulario." />
      <ComingSoon tone="terracotta">
        Elige un tema, descubre tarjetas con audio y una explicación corta, y luego juega una ronda de 60
        segundos: escucha y elige la respuesta correcta.
      </ComingSoon>
    </>
  );
}
