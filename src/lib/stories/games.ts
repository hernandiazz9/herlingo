/**
 * The four games after reading a story, built from its content (framework-free, seeded).
 * Exercises reuse the lesson types from `@/lib/exercises` so the same components and feedback
 * sheet work; `itemIds` are key word ids (SRS), empty for comprehension and ordering.
 */
import { getStoryKeywords, type Pack, type Story, type StorySentence } from "@/lib/content";
import { createRng, type AnswerExercise, type Exercise, type Rng } from "@/lib/exercises";

export type StoryGameId = "keywords" | "gaps" | "questions" | "order";

/** Tap the sentences in story order. `sentences` in story order; `shuffled` = display order. */
export interface OrderStep {
  type: "order";
  key: string;
  sentences: StorySentence[];
  shuffled: string[];
}

export type StoryStep = Exercise | OrderStep;

export interface StoryGame {
  id: StoryGameId;
  title: string;
  description: string;
  steps: StoryStep[];
}

/** Max pairs in the match exercise and words in "listen and pick". */
const MAX_MATCH = 5;
const MAX_LISTEN = 4;
const MAX_QUESTIONS = 4;
/** Sentences to put in order (spread over the whole story). */
const MAX_ORDER = 5;
const CHOICES = 4;

function keywordGame(story: Story, pack: Pack, rng: Rng): StoryStep[] {
  const words = getStoryKeywords(story, pack);
  const steps: StoryStep[] = [];
  const matched = rng.shuffle(words).slice(0, MAX_MATCH);
  if (matched.length >= 2) {
    const pairs = matched.map((w) => ({ id: w.id, text: w.text, es: w.es, audio: w }));
    steps.push({
      type: "match",
      key: "kw-match",
      itemIds: matched.map((w) => w.id),
      solution: { text: "" },
      pairs,
      textOrder: rng.shuffle(pairs.map((p) => p.id)),
      esOrder: rng.shuffle(pairs.map((p) => p.id)),
    });
  }
  // Wrong meanings: the other key words first, then other vocab of the pack.
  const pool = [...new Set([...words.map((w) => w.es), ...rng.shuffle(pack.vocab).slice(0, 12).map((v) => v.es)])];
  for (const w of rng.shuffle(words).slice(0, MAX_LISTEN)) {
    const wrong = rng.shuffle(pool.filter((es) => es !== w.es)).slice(0, CHOICES - 1);
    const options = rng.shuffle([w.es, ...wrong]).map((label, i) => ({ id: `o${i}`, label, correct: label === w.es }));
    steps.push({
      type: "listen-meaning",
      key: `kw-listen-${w.id}`,
      itemIds: [w.id],
      solution: { text: w.text, es: w.es, audio: w },
      audio: w,
      options,
    });
  }
  return steps;
}

function gapGame(story: Story, rng: Rng): StoryStep[] {
  const sentences = new Map(story.sentences.map((s) => [s.id, s]));
  return story.gaps.flatMap((g): StoryStep[] => {
    const s = sentences.get(g.sentence);
    if (!s) return [];
    return [
      {
        type: "fill-gap",
        key: `gap-${g.id}`,
        itemIds: [g.answer],
        solution: { text: s.text, es: s.es, audio: s },
        es: s.es,
        before: g.before,
        after: g.after,
        gap: g.gap,
        options: rng.shuffle([g.gap, ...g.distractors]),
        audio: s,
      },
    ];
  });
}

function questionGame(story: Story): StoryStep[] {
  return story.questions.slice(0, MAX_QUESTIONS).map((q): AnswerExercise => {
    const right = q.options[q.correct] ?? q.options[0];
    return {
      type: "answer",
      key: `q-${q.id}`,
      itemIds: [],
      solution: { text: right.text, es: right.es, audio: right, note: q.text },
      question: q,
      questionEs: q.es,
      options: q.options.map((o, i) => ({ id: `o${i}`, label: o.text, correct: i === q.correct, audio: o })),
    };
  });
}

function orderGame(story: Story, rng: Rng): StoryStep[] {
  const all = story.sentences;
  if (all.length < 2) return [];
  const n = Math.min(MAX_ORDER, all.length);
  // Evenly spread picks keep the story's arc (beginning, middle, end).
  const picked = [...new Set(Array.from({ length: n }, (_, i) => Math.round((i * (all.length - 1)) / (n - 1))))].map((i) => all[i]);
  let shuffled = rng.shuffle(picked.map((s) => s.id));
  if (shuffled.every((id, i) => id === picked[i].id)) shuffled = [...shuffled.slice(1), shuffled[0]];
  return [{ type: "order", key: "order", sentences: picked, shuffled }];
}

/** The games of a story, in play order; games with nothing to play are left out. */
export function buildStoryGames(story: Story, seed: string, pack: Pack): StoryGame[] {
  const rng = createRng(`${story.id}:${seed}`);
  const games: StoryGame[] = [
    { id: "keywords", title: "Palabras clave", description: "Une las parejas y elige lo que oyes.", steps: keywordGame(story, pack, rng) },
    { id: "gaps", title: "Completa los huecos", description: "Elige la palabra que falta en cada frase.", steps: gapGame(story, rng) },
    { id: "questions", title: "Comprensión", description: "Escucha las preguntas sobre la historia y responde.", steps: questionGame(story) },
    { id: "order", title: "Ordena la historia", description: "Toca las frases en el orden en que pasan.", steps: orderGame(story, rng) },
  ];
  return games.filter((g) => g.steps.length > 0);
}

/** XP for finishing a story, plus one per game answer right at the first try. */
export const XP_STORY = 10;

export function storyXp(firstTryCorrect: number): number {
  return XP_STORY + Math.max(0, firstTryCorrect);
}
