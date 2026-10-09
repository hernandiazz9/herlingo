/**
 * Content loader: the ONLY way UI code reads learning content.
 *
 *   import { getPack, getLesson, getLessonItems } from "@/lib/content";
 *
 * Pictures: `listVocab({ situation, withImage: true })`, `getVocab(id)`, `hasImage(item)`; each
 * pictured vocab has `image: { src, dark? }` (pass it to `<Picture>` from `@/components/ui`).
 * Dialogue speakers: `turn.avatar` on native turns, or `getDialogueSpeakers(dialogue)`.
 *
 * Works in server and client components (synchronous, no fetch). The data comes from
 * `./generated/packs.json`, written by `npm run content:build` (runs automatically before dev,
 * build and typecheck; git-ignored). Never import JSON from `content/` directly.
 */
import bundle from "./generated/packs.json";
import type {
  Dialogue,
  ImageRef,
  Lesson,
  LessonItem,
  Level,
  Pack,
  PackMeta,
  PicturedVocab,
  Playable,
  Situation,
  Story,
  StoryKeyword,
  Unit,
  Vocab,
} from "./types";

export type * from "./types";
export { audioKey } from "./keys";
export {
  DEFAULT_GLOSS_LANG,
  GLOSS_LANGUAGES,
  glossesOf,
  glossLangsOf,
  glossOf,
  glossTag,
  isGlossLang,
  type GlossBase,
} from "./gloss";
export { foldText, romanize, stripStress, type ScriptRulesSource } from "./script";

interface Bundle {
  defaultLang: string;
  packs: Record<string, Pack>;
}

const data = bundle as unknown as Bundle;

/**
 * The default pack's language (`pack.json` `"default": true`): used when none is given. The
 * learner's current language is the active one (`getActiveLang()` from `@/lib/content/active`).
 */
export const DEFAULT_LANG = data.defaultLang;

/** Every pack's language, default first. */
export function listLangs(): string[] {
  return listPacks().map((m) => m.lang);
}

let packMetas: PackMeta[] | undefined;

/** Every pack's meta (name, flag `emoji`, voices…), sorted with the default pack first. */
export function listPacks(): PackMeta[] {
  packMetas ??= Object.values(data.packs)
    .map((p) => p.meta)
    .sort((a, b) => (a.lang === DEFAULT_LANG ? -1 : b.lang === DEFAULT_LANG ? 1 : a.lang.localeCompare(b.lang)));
  return packMetas;
}

/** True when a pack exists for `lang`. */
export function hasPack(lang: string): boolean {
  return Object.prototype.hasOwnProperty.call(data.packs, lang);
}

export function getPack(lang: string = DEFAULT_LANG): Pack {
  const pack = data.packs[lang];
  if (!pack) throw new Error(`No content pack for "${lang}"`);
  return pack;
}

/** The pack's language name to use inside a Spanish sentence: "italiano", "francés". */
export function languageName(lang: string): string {
  return getPack(lang).meta.name.toLocaleLowerCase("es");
}

/**
 * The pack's CEFR levels in order (`pack.json` `levels`), or [] for a pack that is one course.
 * In a levelled pack, units, dialogues, stories, placement questions and items carry `level`
 * (an item's level is the level of the unit that defines it, derived by `content:build`).
 */
export function getLevels(pack: Pack = getPack()): Level[] {
  return pack.meta.levels ?? [];
}

interface Index {
  items: Map<string, LessonItem>;
  lessons: Map<string, Lesson>;
  units: Map<string, Unit>;
  dialogues: Map<string, Dialogue>;
  stories: Map<string, Story>;
  situations: Map<string, Situation>;
}

const indexes = new WeakMap<Pack, Index>();

function index(pack: Pack): Index {
  let idx = indexes.get(pack);
  if (!idx) {
    const items = new Map<string, LessonItem>();
    for (const list of [pack.phrases, pack.vocab, pack.qa, pack.grammar, pack.expressions]) {
      for (const item of list) items.set(item.id, item);
    }
    idx = {
      items,
      lessons: new Map(pack.units.flatMap((u) => u.lessons.map((l) => [l.id, l] as const))),
      units: new Map(pack.units.map((u) => [u.id, u])),
      dialogues: new Map(pack.dialogues.map((d) => [d.id, d])),
      stories: new Map(pack.stories.map((s) => [s.id, s])),
      situations: new Map(pack.meta.situations.map((s) => [s.id, s])),
    };
    indexes.set(pack, idx);
  }
  return idx;
}

/** Phrase, vocab, Q&A, grammar card or expression by id (check `.kind`). */
export function getItem(id: string, pack: Pack = getPack()): LessonItem | undefined {
  return index(pack).items.get(id);
}

export function getUnit(id: string, pack: Pack = getPack()): Unit | undefined {
  return index(pack).units.get(id);
}

export function getLesson(id: string, pack: Pack = getPack()): Lesson | undefined {
  return index(pack).lessons.get(id);
}

/** The lesson's items, resolved, in teaching order. */
export function getLessonItems(lesson: Lesson, pack: Pack = getPack()): LessonItem[] {
  const items = index(pack).items;
  return lesson.items.map((id) => items.get(id)).filter((x): x is LessonItem => x !== undefined);
}

/** Every lesson in path order (units by `order`, then lesson position). */
export function getAllLessons(pack: Pack = getPack()): Lesson[] {
  return pack.units.flatMap((u) => u.lessons);
}

export function getDialogue(id: string, pack: Pack = getPack()): Dialogue | undefined {
  return index(pack).dialogues.get(id);
}

// Ids are unique across packs (`content:check`), so an id names at most one pack. Routes shared
// by every pack (/leccion/<id>/, /dialogos/<id>/, /historias/<id>/) use these to find it.

function findPack(has: (idx: Index) => boolean): Pack | undefined {
  for (const lang of listLangs()) {
    const pack = data.packs[lang];
    if (has(index(pack))) return pack;
  }
  return undefined;
}

/** The pack that owns lesson `id`, or undefined. */
export function findLessonPack(id: string): Pack | undefined {
  return findPack((idx) => idx.lessons.has(id));
}

/** The pack that owns dialogue `id`, or undefined. */
export function findDialoguePack(id: string): Pack | undefined {
  return findPack((idx) => idx.dialogues.has(id));
}

/** The pack that owns story `id`, or undefined. */
export function findStoryPack(id: string): Pack | undefined {
  return findPack((idx) => idx.stories.has(id));
}

export function getSituation(id: string, pack: Pack = getPack()): Situation | undefined {
  return index(pack).situations.get(id);
}

/**
 * Every playable text in the pack, deduplicated by audio key. Used by the mp3 generator (T03);
 * the UI normally passes items straight to `speak()`.
 */
export function listPlayables(pack: Pack = getPack()): Playable[] {
  const out = new Map<string, Playable>();
  const add = (p: Playable | undefined) => {
    if (p) out.set(p.audioKey, { text: p.text, audioKey: p.audioKey, voice: p.voice });
  };
  pack.phrases.forEach(add);
  pack.vocab.forEach(add);
  pack.expressions.forEach(add);
  for (const q of pack.qa) {
    add(q);
    q.accepted.forEach(add);
    q.distractors.forEach(add);
  }
  for (const g of pack.grammar) g.examples.forEach(add);
  for (const d of pack.dialogues) {
    for (const t of d.turns) {
      if (t.speaker === "native") add(t);
      else t.options.forEach(add);
    }
  }
  for (const q of pack.placement) add(q.audio);
  for (const s of pack.stories) {
    s.sentences.forEach(add);
    for (const q of s.questions) {
      add(q);
      q.options.forEach(add);
    }
  }
  return [...out.values()];
}

/** Every story, in trip order (`order`). */
export function getStories(pack: Pack = getPack()): Story[] {
  return pack.stories;
}

export function getStory(id: string, pack: Pack = getPack()): Story | undefined {
  return index(pack).stories.get(id);
}

/**
 * The story's key words, resolved (vocab / phrase / expression, each playable with `text` and
 * `es`), in story order. Their ids are normal item ids: record SRS outcomes on them.
 */
export function getStoryKeywords(story: Story, pack: Pack = getPack()): StoryKeyword[] {
  const items = index(pack).items;
  return story.keywords
    .map((id) => items.get(id))
    .filter((x): x is StoryKeyword => x !== undefined && (x.kind === "vocab" || x.kind === "phrase" || x.kind === "expression"));
}

// ---------------------------------------------------------------------------------------------
// Vocabulary and pictures
// ---------------------------------------------------------------------------------------------

export interface ListVocabOptions {
  /** Only words of this situation id (pack.json `situations`). */
  situation?: string;
  /** Only words that have a picture (`image` present: its file exists in public/images/). */
  withImage?: boolean;
}

/**
 * Vocabulary in pack order (unit files by name, then extras, then inline story key words),
 * optionally filtered by situation and/or to pictured words. With `withImage: true` the result is
 * typed `PicturedVocab[]` (`image` is guaranteed). Several words may share one picture: compare
 * `image.src` when you need options that look different.
 *
 *   listVocab({ situation: "bar", withImage: true })
 */
export function listVocab(options: ListVocabOptions & { withImage: true }, pack?: Pack): PicturedVocab[];
export function listVocab(options?: ListVocabOptions, pack?: Pack): Vocab[];
export function listVocab({ situation, withImage }: ListVocabOptions = {}, pack: Pack = getPack()): Vocab[] {
  return pack.vocab.filter((v) => (!situation || v.situation === situation) && (!withImage || v.image));
}

/** Vocab item by id (with its `image` when it has one), or undefined for unknown / non-vocab ids. */
export function getVocab(id: string, pack: Pack = getPack()): Vocab | undefined {
  const item = index(pack).items.get(id);
  return item?.kind === "vocab" ? item : undefined;
}

/**
 * Type guard: the item is vocab with a picture. Works on any lesson item / story key word, e.g.
 * `getLessonItems(lesson).filter(hasImage)` → `PicturedVocab[]`.
 */
export function hasImage(item: LessonItem | StoryKeyword | undefined): item is PicturedVocab {
  return item?.kind === "vocab" && item.image !== undefined;
}

export interface DialogueSpeaker {
  /** Native turn `name` ("Camarero"). */
  name: string;
  /** Avatar picture, when the dialogue sets one and its file exists. */
  avatar?: ImageRef;
}

/** The dialogue's named native speakers in order of appearance, each with its avatar if any. */
export function getDialogueSpeakers(dialogue: Dialogue): DialogueSpeaker[] {
  const out = new Map<string, DialogueSpeaker>();
  for (const t of dialogue.turns) {
    if (t.speaker === "native" && t.name && !out.has(t.name)) out.set(t.name, { name: t.name, avatar: t.avatar });
  }
  return [...out.values()];
}
