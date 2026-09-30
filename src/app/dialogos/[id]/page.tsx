import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DialogueSimulator } from "@/components/dialogue/DialogueSimulator";
import { PageHeader } from "@/components/shell/PageHeader";
import { getDialogue, getPack } from "@/lib/content";

export const dynamicParams = false;

export function generateStaticParams() {
  return getPack().dialogues.map((d) => ({ id: d.id }));
}

export async function generateMetadata({ params }: PageProps<"/dialogos/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getDialogue(decodeURIComponent(id))?.title ?? "Diálogo" };
}

export default async function DialoguePage({ params }: PageProps<"/dialogos/[id]">) {
  const { id: raw } = await params;
  const id = decodeURIComponent(raw);
  const dialogue = getDialogue(id);
  if (!dialogue) notFound();
  return (
    <>
      <Link href="/dialogos" className="self-start text-sm font-bold text-sea">
        ← Diálogos
      </Link>
      <PageHeader title={dialogue.title} />
      <DialogueSimulator id={id} />
    </>
  );
}
