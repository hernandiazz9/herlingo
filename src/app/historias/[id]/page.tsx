import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { StoryView } from "@/components/stories/StoryView";
import { findStoryPack, getPack, getSituation, getStories, getStory, listLangs } from "@/lib/content";

export const dynamicParams = false;

/** Every pack's stories (ids are unique across packs). */
export function generateStaticParams() {
  return listLangs().flatMap((lang) => getStories(getPack(lang)).map((s) => ({ id: s.id })));
}

export async function generateMetadata({ params }: PageProps<"/historias/[id]">): Promise<Metadata> {
  const id = decodeURIComponent((await params).id);
  const pack = findStoryPack(id);
  return { title: (pack && getStory(id, pack)?.titleEs) ?? "Historia" };
}

export default async function StoryPage({ params }: PageProps<"/historias/[id]">) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const pack = findStoryPack(id);
  const story = pack && getStory(id, pack);
  if (!pack || !story) notFound();
  const situation = getSituation(story.situation, pack);
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
      <StoryView id={id} lang={pack.meta.lang} />
    </>
  );
}
