import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TopicView } from "@/components/grammar/TopicView";
import { VerbView } from "@/components/grammar/VerbView";
import { PageHeader } from "@/components/shell/PageHeader";
import { Gloss } from "@/components/ui";
import { findGrammarPack, getGrammarEntry, getPack, glossLangsOf, glossOf, listLangs, listVerbs } from "@/lib/content";
import { getTab } from "@/lib/navigation";

export const dynamicParams = false;

const tab = getTab("grammar");

/** Every pack's verbs and grammar cards (ids are unique across packs). */
export function generateStaticParams() {
  return listLangs().flatMap((lang) => {
    const pack = getPack(lang);
    return [...listVerbs(pack).map((v) => v.id), ...pack.grammar.map((c) => c.id)].map((id) => ({ id }));
  });
}

export async function generateMetadata({ params }: PageProps<"/gramatica/[id]">): Promise<Metadata> {
  const id = decodeURIComponent((await params).id);
  const pack = findGrammarPack(id);
  const entry = pack && getGrammarEntry(id, pack);
  if (!pack || !entry) return { title: tab.title };
  // The pack's default gloss language (the learner's choice is only known on the device).
  return { title: entry.kind === "verb" ? entry.verb.infinitive : glossOf(entry.card.title, glossLangsOf(pack.meta)[0]) };
}

/** A verb or a topic of any pack (the owner pack: `findGrammarPack`). */
export default async function GrammarEntryPage({ params }: PageProps<"/gramatica/[id]">) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const pack = findGrammarPack(id);
  const entry = pack && getGrammarEntry(id, pack);
  if (!pack || !entry) notFound();
  const lang = pack.meta.lang;
  return (
    <>
      <Link href={tab.href} className="self-start text-sm font-bold text-sea">
        ← {tab.title}
      </Link>
      {entry.kind === "verb" ? (
        <VerbView id={id} lang={lang} />
      ) : (
        <>
          <PageHeader title={<Gloss of={entry.card.title} lang={lang} />} />
          <TopicView id={id} lang={lang} />
        </>
      )}
    </>
  );
}
