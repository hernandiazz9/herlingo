import type { Metadata } from "next";
import { GameView } from "@/components/game/GameView";
import { PageHeader } from "@/components/shell/PageHeader";
import { SportEntryCard } from "@/components/sport/SportEntryCard";
import { getTab } from "@/lib/navigation";

const tab = getTab("play");

export const metadata: Metadata = { title: tab.title };

export default function PlayPage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Partidas rápidas por temas para sumar mucho vocabulario." />
      <GameView />
      {/* After the game: above it, it would push a running round down the screen. */}
      <SportEntryCard />
    </>
  );
}
