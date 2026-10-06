import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DialogueSimulator } from "@/components/dialogue/DialogueSimulator";
import { PageHeader } from "@/components/shell/PageHeader";
import { findDialoguePack, getDialogue, getPack, listLangs } from "@/lib/content";

export const dynamicParams = false;

/** Every pack's dialogues (ids are unique across packs). */
export function generateStaticParams() {
  return listLangs().flatMap((lang) => getPack(lang).dialogues.map((d) => ({ id: d.id })));
}

export async function generateMetadata({ params }: PageProps<"/dialogos/[id]">): Promise<Metadata> {
  const id = decodeURIComponent((await params).id);
  const pack = findDialoguePack(id);
  return { title: (pack && getDialogue(id, pack)?.title) ?? "Diálogo" };
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
      <PageHeader title={dialogue.title} />
      <DialogueSimulator id={id} lang={pack.meta.lang} />
    </>
  );
}
