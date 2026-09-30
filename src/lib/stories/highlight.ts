import type { Story, StoryKeyword } from "@/lib/content";

export interface Segment {
  text: string;
  /** Key word item id when this piece of the sentence is a key word. */
  keywordId?: string;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const trimPunct = (s: string) => s.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");

/** Surface forms to look for in the story text, per key word (longest first overall). */
function forms(story: Story, keywords: StoryKeyword[]): { id: string; pattern: string }[] {
  const out: { id: string; pattern: string }[] = [];
  const add = (id: string, form: string | undefined, stem = false) => {
    const f = form ? trimPunct(form) : "";
    if (f.length < 2) return;
    out.push({ id, pattern: stem ? `${escape(f)}\\p{L}{0,4}` : escape(f) });
  };
  for (const k of keywords) {
    add(k.id, k.text);
    if (k.kind === "vocab") {
      add(k.id, k.word);
      add(k.id, k.plural);
      // Verbs (-are/-ere/-ire): match the conjugated forms by stem ("cercare" → "cerca").
      const verb = /^(\p{L}{3,})[aei]re$/u.exec(k.word);
      if (verb) add(k.id, verb[1], true);
    }
  }
  for (const g of story.gaps) add(g.answer, g.gap);
  return out.sort((a, b) => b.pattern.length - a.pattern.length);
}

/**
 * Splits each sentence into plain text and key-word pieces (case-insensitive, whole words).
 * Returns sentence id → segments.
 */
export function segmentStory(story: Story, keywords: StoryKeyword[]): Map<string, Segment[]> {
  const list = forms(story, keywords);
  const out = new Map<string, Segment[]>();
  const re = list.length
    ? new RegExp(`(^|[^\\p{L}\\p{N}])(?:${list.map((f) => `(${f.pattern})`).join("|")})(?![\\p{L}\\p{N}])`, "giu")
    : undefined;
  for (const s of story.sentences) {
    const segs: Segment[] = [];
    let last = 0;
    if (re) {
      for (const m of s.text.matchAll(re)) {
        const at = (m.index ?? 0) + m[1].length;
        const group = m.findIndex((g, i) => i > 1 && g !== undefined);
        if (group < 2) continue;
        if (at > last) segs.push({ text: s.text.slice(last, at) });
        segs.push({ text: m[group], keywordId: list[group - 2].id });
        last = at + m[group].length;
      }
    }
    if (last < s.text.length) segs.push({ text: s.text.slice(last) });
    out.set(s.id, segs);
  }
  return out;
}
