import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Phrasebook } from "@/components/phrasebook/Phrasebook";
import { getTab } from "@/lib/navigation";

const tab = getTab("phrasebook");

export const metadata: Metadata = { title: tab.title };

export default function PhrasebookPage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Toca una frase o una palabra para escucharla." />
      <Phrasebook />
    </>
  );
}
