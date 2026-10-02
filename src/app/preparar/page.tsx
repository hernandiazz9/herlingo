import type { Metadata } from "next";
import { Suspense } from "react";
import { CoachView } from "@/components/coach/CoachView";
import { PREPARE_SUBTITLE, PREPARE_TITLE } from "@/components/coach/nav";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: PREPARE_TITLE };

export default function PreparePage() {
  return (
    // CoachView reads `?pack=` (useSearchParams): the static HTML holds only this header.
    <Suspense fallback={<PageHeader title={PREPARE_TITLE} subtitle={PREPARE_SUBTITLE} />}>
      <CoachView />
    </Suspense>
  );
}
