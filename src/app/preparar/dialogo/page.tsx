import type { Metadata } from "next";
import { Suspense } from "react";
import { PackPractice } from "@/components/coach/PackPractice";
import { PRACTICE_TITLE } from "@/components/coach/practice-nav";
import { PageHeader } from "@/components/shell/PageHeader";

export const metadata: Metadata = { title: PRACTICE_TITLE };

export default function PracticePage() {
  return (
    // PackPractice reads `?pack=` (useSearchParams): the static HTML holds only this header.
    <Suspense fallback={<PageHeader title={PRACTICE_TITLE} />}>
      <PackPractice />
    </Suspense>
  );
}
