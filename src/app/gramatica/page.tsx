import type { Metadata } from "next";
import { GrammarIndex } from "@/components/grammar/GrammarIndex";
import { PageHeader } from "@/components/shell/PageHeader";
import { getTab } from "@/lib/navigation";

const tab = getTab("grammar");

export const metadata: Metadata = { title: tab.title };

export default function GrammarPage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Verbos y temas para consultar cuando quieras." />
      <GrammarIndex />
    </>
  );
}
