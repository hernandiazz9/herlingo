import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { StoryView } from "@/components/stories/StoryView";
import { getPack, getSituation, getStories, getStory } from "@/lib/content";

export const dynamicParams = false;

export function generateStaticParams() {
  return getStories().map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/historias/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getStory(decodeURIComponent(id))?.titleEs ?? "Historia" };
}

export default async function StoryPage({ params }: PageProps<"/historias/[id]">) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const story = getStory(id);
  if (!story) notFound();
  const situation = getSituation(story.situation);
  return (
    <>
      <Link href="/historias/" className="self-start text-sm font-bold text-sea">
        ← Historias
      </Link>
      <PageHeader
        title={story.title}
        subtitle={
          <>
            {story.titleEs}
            {situation ? ` · ${situation.emoji ? `${situation.emoji} ` : ""}${situation.title}` : ""}
          </>
        }
      />
      <StoryView id={id} lang={getPack().meta.lang} />
    </>
  );
}
