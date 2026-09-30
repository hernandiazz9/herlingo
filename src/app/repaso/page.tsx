import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { getTab } from "@/lib/navigation";
import { ReviewView } from "./ReviewView";

const tab = getTab("review");

export const metadata: Metadata = { title: tab.title };

export default function ReviewPage() {
  return (
    <>
      <PageHeader title={tab.title} subtitle="Repasa lo que fallas o estás a punto de olvidar." />
      <ReviewView />
    </>
  );
}
