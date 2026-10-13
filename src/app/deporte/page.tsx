import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { SPORT_SUBTITLE, SPORT_TITLE } from "@/components/sport/nav";
import { SportView } from "@/components/sport/SportView";

export const metadata: Metadata = { title: SPORT_TITLE };

export default function SportPage() {
  return (
    // SportView reads `?ep=` (useSearchParams): the static HTML holds only this header.
    <Suspense fallback={<PageHeader title={SPORT_TITLE} subtitle={SPORT_SUBTITLE} />}>
      <SportView />
    </Suspense>
  );
}
