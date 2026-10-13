"use client";

import Link from "next/link";
import { useState } from "react";
import { LessonPlayer } from "@/components/lesson";
import { useHideQuickFab } from "@/components/shell/QuickFab";
import { Button, Card, TargetText } from "@/components/ui";
import { getItem, getPack, glossOf, type Lesson } from "@/lib/content";
import { useGlossLang } from "@/lib/content/use-gloss";
import { useScreenLang } from "@/lib/content/use-active-lang";
import type { LearnCopy } from "@/lib/i18n/learn-copy";
import { useLearnCopyFor } from "@/lib/i18n/use-learn-copy";
import { defaultSessionSize, type LessonResult } from "@/lib/exercises";
import { dueItemIds, recordReviewResult } from "@/lib/progress";
import { startOfDay } from "@/lib/progress/dates";
import { useHydrated, useNow, useProgress } from "@/lib/progress/use-progress";
import { REVIEW_SIZE, dedupeByText, nextDue } from "@/lib/srs";

/** Due items (spaced repetition) and a review session through the lesson player. */
export function ReviewView() {
  const lang = useScreenLang();
  return lang ? <Review key={lang} lang={lang} /> : null;
}

function Review({ lang }: { lang: string }) {
  const pack = getPack(lang);
  const gloss = useGlossLang(lang);
  const copy = useLearnCopyFor(lang);
  const progress = useProgress(lang);
  const now = useNow();
  const hydrated = useHydrated();
  const [session, setSession] = useState<Lesson | null>(null);
  // A running review session: no ⚡ button.
  useHideQuickFab(session !== null);

  if (!hydrated || !now) return null;

  // Same target-language text under two ids: ask it once; the answer counts for both ids.
  const { ids: due, aliases } = dedupeByText(dueItemIds(progress, pack, now), (id) => {
    const item = getItem(id, pack);
    return item && item.kind !== "grammar" ? item.text : undefined;
  });
  const complete = (result: LessonResult) =>
    recordReviewResult({
      ...result,
      items: result.items.flatMap((o) => [o, ...(aliases.get(o.itemId) ?? []).map((itemId) => ({ ...o, itemId }))]),
    });
  const wrong = due.filter((id) => (progress.srs[id]?.box ?? 0) >= 1 && (progress.srs[id]?.lapses ?? 0) > 0).length;
  const fresh = due.filter((id) => progress.srs[id]?.box === 0).length;
  const next = nextDue(progress.srs, now);

  const start = () => {
    const items = due.slice(0, REVIEW_SIZE);
    setSession({ id: "review", title: copy.reviewTitle(items.length), items, unitId: "", index: 0 });
  };

  if (session) {
    // Short reviews stay short: about two exercises per item.
    const size = Math.min(defaultSessionSize(session.items.length), Math.max(4, session.items.length * 2));
    return (
      <LessonPlayer
        lang={lang}
        lesson={session}
        sessionSize={size}
        intro={copy.reviewIntro}
        onComplete={complete}
        onExit={() => setSession(null)}
      />
    );
  }

  if (!due.length) {
    const tracked = Object.keys(progress.srs).length;
    return (
      <Card tone="sea" className="flex flex-col gap-3">
        <p aria-hidden="true" className="text-5xl">
          {tracked ? "✅" : "🌱"}
        </p>
        <p className="text-xl font-extrabold text-ink">{tracked ? copy.allDone : copy.nothingYet}</p>
        <p className="text-base text-ink">
          {tracked
            ? copy.nextComes(whenLabel(next, now, copy))
            : copy.reviewEmptyHint}
        </p>
        <Link
          href="/"
          className="pressable inline-flex min-h-12 items-center justify-center rounded-button border-2 border-line bg-surface px-5 text-base font-bold text-sea [--ledge:var(--line)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-lemon-deep"
        >
          {copy.goToPath}
        </Link>
      </Card>
    );
  }

  const preview = due.slice(0, REVIEW_SIZE).map((id) => getItem(id, pack)).filter((i) => !!i);

  return (
    <>
      <Card tone="lemon" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-sm font-bold uppercase tracking-wider text-terracotta-deep">{copy.dueToday}</p>
          <p className="text-3xl font-extrabold text-ink">{due.length}</p>
          <p className="text-base text-ink">
            {[wrong ? copy.dueWrong(wrong) : "", fresh ? copy.dueFresh(fresh) : "", due.length - wrong - fresh > 0 ? copy.dueFading(due.length - wrong - fresh) : ""]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <Button fullWidth onClick={start}>
          {copy.startReview}
        </Button>
        {due.length > REVIEW_SIZE ? (
          <p className="text-sm text-ink-muted">{copy.reviewChunks(REVIEW_SIZE)}</p>
        ) : null}
      </Card>
      <section aria-labelledby="review-next" className="flex flex-col gap-2">
        <h2 id="review-next" className="text-lg font-bold text-ink">
          {copy.inThisReview}
        </h2>
        <ul className="flex flex-col gap-2">
          {preview.map((item) => (
            <li key={item.id} className="rounded-card border-2 border-line bg-surface px-4 py-3">
              {item.kind === "grammar" ? (
                <span lang={gloss.tag} className="font-bold text-ink">
                  {glossOf(item.title, gloss.lang)}
                </span>
              ) : (
                <TargetText text={item.text} lang={pack.meta.lang}>
                  <span lang={pack.meta.lang} className="font-bold text-ink">
                    {item.text}
                  </span>
                  <span className="text-ink-muted">
                    {" · "}
                    <span lang={gloss.tag}>{glossOf(item, gloss.lang, item.kind === "qa" ? "question" : undefined)}</span>
                  </span>
                </TargetText>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function whenLabel(due: number | undefined, now: number, copy: LearnCopy): string {
  if (!due) return copy.whenLater;
  const days = Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);
  if (days <= 0) return copy.whenToday;
  if (days === 1) return copy.whenTomorrow;
  return copy.whenInDays(days);
}
