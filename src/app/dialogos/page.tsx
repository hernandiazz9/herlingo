import type { Metadata } from "next";
import { DialogueList } from "@/components/dialogue/DialogueList";
import { PageHeader } from "@/components/shell/PageHeader";
import { getTab } from "@/lib/navigation";

const tab = getTab("dialogues");

export const metadata: Metadata = { title: tab.title };

export default function DialoguesPage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Practica conversaciones como las que vas a tener." />
      <DialogueList />
    </>
  );
}
