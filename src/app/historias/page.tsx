import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { StoryList } from "@/components/stories/StoryList";
import { getTab } from "@/lib/navigation";

const tab = getTab("stories");

export const metadata: Metadata = { title: tab.title };

export default function StoriesPage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Historias cortas que siguen tu viaje, frase a frase." />
      <StoryList />
    </>
  );
}
