import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { QUICK_SUBTITLE, QUICK_TITLE } from "@/components/quick/nav";
import { QuickView } from "@/components/quick/QuickView";

export const metadata: Metadata = { title: QUICK_TITLE };

export default function QuickPage() {
  return (
    // QuickView reads `?ruta=` (useSearchParams): the static HTML holds only this header.
    <Suspense fallback={<PageHeader title={QUICK_TITLE} subtitle={QUICK_SUBTITLE} />}>
      <QuickView />
    </Suspense>
  );
}
