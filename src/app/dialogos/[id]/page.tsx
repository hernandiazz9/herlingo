import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DialogueSimulator } from "@/components/dialogue/DialogueSimulator";
import { PageHeader } from "@/components/shell/PageHeader";
import { Gloss } from "@/components/ui";
import { findDialoguePack, getDialogue, getPack, glossLangsOf, glossOf, listLangs } from "@/lib/content";

export const dynamicParams = false;

/** Every pack's dialogues (ids are unique across packs). */
export function generateStaticParams() {
  return listLangs().flatMap((lang) => getPack(lang).dialogues.map((d) => ({ id: d.id })));
}

export async function generateMetadata({ params }: PageProps<"/dialogos/[id]">): Promise<Metadata> {
  const id = decodeURIComponent((await params).id);
  const pack = findDialoguePack(id);
  const title = pack && getDialogue(id, pack)?.title;
  // The pack's default gloss language (the learner's choice is only known on the device).
  return { title: (pack && title !== undefined && glossOf(title, glossLangsOf(pack.meta)[0])) || "Diálogo" };
}

export default async function DialoguePage({ params }: PageProps<"/dialogos/[id]">) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const pack = findDialoguePack(id);
  const dialogue = pack && getDialogue(id, pack);
  if (!pack || !dialogue) notFound();
  return (
    <>
      <Link href="/dialogos/" className="self-start text-sm font-bold text-sea">
        ← Diálogos
      </Link>
      <PageHeader title={<Gloss of={dialogue.title} lang={pack.meta.lang} />} />
      <DialogueSimulator id={id} lang={pack.meta.lang} />
    </>
  );
}
