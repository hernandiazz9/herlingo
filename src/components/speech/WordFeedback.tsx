import { cn } from "@/lib/cn";
import type { ScoredWord } from "@/lib/speech";

export interface WordFeedbackProps {
  /** `scoreHeard(...).words`: the expected phrase, word by word. */
  words: readonly ScoredWord[];
  /** `lang` of the phrase (the pack's language). */
  lang?: string;
  /** What was heard (`scoreHeard(...).heard`): shown as "He entendido: «…»" when not empty. */
  heard?: string;
  className?: string;
}

const WORD_STYLE: Record<ScoredWord["status"], string> = {
  ok: "bg-success-soft text-success-deep",
  // Non-colour cues: missing = struck through, wrong = wavy underline.
  missing: "bg-error-soft text-error-deep line-through decoration-2",
  wrong: "bg-error-soft text-error-deep underline decoration-wavy decoration-2 underline-offset-4",
};

const WORD_LABEL: Record<ScoredWord["status"], string> = {
  ok: "bien",
  missing: "no lo he oído",
  wrong: "has dicho otra cosa",
};

/**
 * The expected phrase with each word marked right / missing / wrong (tokens + a non-colour cue),
 * the word heard in place of a wrong one under it, and "He entendido: «…»". Lessons and dialogues.
 */
export function WordFeedback({ words, lang, heard, className }: WordFeedbackProps) {
  if (!words.length) return null;
  return (
    <div className={cn("flex w-full flex-col gap-3", className)}>
      <p className="flex flex-wrap gap-x-1.5 gap-y-2 text-xl font-bold" lang={lang}>
        {words.map((w, i) => (
          <span key={i} className="inline-flex flex-col items-center">
            <span className={cn("rounded-md px-1.5 py-0.5", WORD_STYLE[w.status])}>
              {w.text}
              <span className="sr-only"> ({WORD_LABEL[w.status]}{w.status === "wrong" && w.heard ? `: «${w.heard}»` : ""})</span>
            </span>
            {w.status === "wrong" && w.heard ? (
              <span aria-hidden="true" className="text-sm font-normal text-ink-muted">
                {w.heard}
              </span>
            ) : null}
          </span>
        ))}
      </p>
      <p className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink-muted" aria-hidden="true">
        <span>
          <span className="rounded-md bg-success-soft px-1 font-bold text-success-deep">bien</span>
        </span>
        <span>
          <span className="rounded-md bg-error-soft px-1 font-bold text-error-deep underline decoration-wavy underline-offset-4">
            otra cosa
          </span>
        </span>
        <span>
          <span className="rounded-md bg-error-soft px-1 font-bold text-error-deep line-through">no oída</span>
        </span>
      </p>
      {heard ? (
        <p className="text-base text-ink-muted">
          He entendido:{" "}
          <span lang={lang} className="font-bold text-ink">
            «{heard}»
          </span>
        </p>
      ) : null}
    </div>
  );
}
