/**
 * Validates and normalises one language pack. Pure: takes already-read JSON, returns the pack
 * plus a list of errors. Used by `scripts/content.ts` only (the app never imports zod).
 */
import type { z } from "zod";
import { audioKey, vocabText } from "./keys";
import * as S from "./schema";
import type {
  Dialogue,
  Expression,
  GrammarCard,
  LessonItemKind,
  Pack,
  Phrase,
  PlacementQuestion,
  QA,
  Unit,
  Vocab,
} from "./types";

export interface SourceFile {
  /** Path relative to the repo root, used in error messages. */
  file: string;
  data: unknown;
}

export interface PackSources {
  lang: string;
  meta: SourceFile;
  units: SourceFile[];
  dialogues: SourceFile[];
  extras: SourceFile[];
}

export interface BuildResult {
  pack: Pack | null;
  errors: string[];
}

function parse<T extends z.ZodType>(schema: T, src: SourceFile, errors: string[]): z.infer<T> | null {
  const res = schema.safeParse(src.data);
  if (res.success) return res.data;
  for (const issue of res.error.issues) {
    errors.push(`${src.file}: ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  }
  return null;
}

export function buildPack(src: PackSources): BuildResult {
  const errors: string[] = [];
  const schemaErrors: string[] = [];
  const meta = parse(S.PackMeta, src.meta, schemaErrors);
  if (!meta) return { pack: null, errors: schemaErrors };
  if (meta.lang !== src.lang) errors.push(`${src.meta.file}: lang "${meta.lang}" must equal folder name "${src.lang}"`);

  const defaultVoice = meta.voices[0];
  const situations = new Set<string>();
  for (const s of meta.situations) {
    if (situations.has(s.id)) errors.push(`${src.meta.file}: duplicate situation "${s.id}"`);
    situations.add(s.id);
  }

  // One id namespace for everything in the pack.
  const owners = new Map<string, string>();
  const kinds = new Map<string, LessonItemKind | "unit" | "lesson" | "dialogue" | "placement">();
  const claim = (id: string, kind: Parameters<typeof kinds.set>[1], file: string) => {
    const prev = owners.get(id);
    if (prev) errors.push(`${file}: duplicate id "${id}" (already used in ${prev})`);
    else {
      owners.set(id, file);
      kinds.set(id, kind);
    }
  };
  const checkVoice = (voice: string | undefined, where: string) => {
    if (voice && !meta.voices.includes(voice)) errors.push(`${where}: voice "${voice}" is not in pack.json voices`);
    return voice ?? defaultVoice;
  };
  const checkSituation = (situation: string | undefined, where: string) => {
    if (situation && !situations.has(situation)) errors.push(`${where}: unknown situation "${situation}"`);
  };

  const phrases: Phrase[] = [];
  const vocab: Vocab[] = [];
  const qa: QA[] = [];
  const grammar: GrammarCard[] = [];
  const expressions: Expression[] = [];
  const placement: PlacementQuestion[] = [];

  const addItems = (file: string, f: z.infer<typeof S.ExtrasFile> | z.infer<typeof S.UnitFile>) => {
    for (const p of f.phrases) {
      const where = `${file}: phrase "${p.id}"`;
      claim(p.id, "phrase", file);
      checkSituation(p.situation, where);
      phrases.push({ ...p, kind: "phrase", audioKey: audioKey(p.id), voice: checkVoice(p.voice, where) });
    }
    for (const v of f.vocab) {
      const where = `${file}: vocab "${v.id}"`;
      claim(v.id, "vocab", file);
      checkSituation(v.situation, where);
      vocab.push({
        ...v,
        kind: "vocab",
        text: vocabText(v.word, v.article),
        audioKey: audioKey(v.id),
        voice: checkVoice(v.voice, where),
      });
    }
    for (const q of f.qa) {
      const where = `${file}: qa "${q.id}"`;
      claim(q.id, "qa", file);
      checkSituation(q.situation, where);
      const voice = checkVoice(q.voice, where);
      qa.push({
        ...q,
        kind: "qa",
        text: q.question,
        audioKey: audioKey(q.id, "q"),
        voice,
        accepted: q.accepted.map((r, i) => ({ ...r, audioKey: audioKey(q.id, `a${i + 1}`), voice: defaultVoice })),
        distractors: q.distractors.map((r, i) => ({ ...r, audioKey: audioKey(q.id, `d${i + 1}`), voice: defaultVoice })),
      });
    }
    for (const g of f.grammar) {
      claim(g.id, "grammar", file);
      grammar.push({
        ...g,
        kind: "grammar",
        examples: g.examples.map((e, i) => ({ ...e, audioKey: audioKey(g.id, `e${i + 1}`), voice: defaultVoice })),
      });
    }
    for (const x of f.expressions) {
      const where = `${file}: expression "${x.id}"`;
      claim(x.id, "expression", file);
      expressions.push({ ...x, kind: "expression", audioKey: audioKey(x.id), voice: checkVoice(x.voice, where) });
    }
  };

  // Units
  const units: Unit[] = [];
  const unitOrders = new Map<number, string>();
  for (const s of src.units) {
    const u = parse(S.UnitFile, s, schemaErrors);
    if (!u) continue;
    claim(u.id, "unit", s.file);
    checkSituation(u.situation, `${s.file}: unit "${u.id}"`);
    const clash = unitOrders.get(u.order);
    if (clash) errors.push(`${s.file}: unit order ${u.order} already used by unit "${clash}"`);
    unitOrders.set(u.order, u.id);
    for (const l of u.lessons) claim(l.id, "lesson", s.file);
    addItems(s.file, u);
    units.push({
      id: u.id,
      order: u.order,
      title: u.title,
      description: u.description,
      emoji: u.emoji,
      situation: u.situation,
      lessons: u.lessons.map((l, index) => ({ ...l, unitId: u.id, index })),
    });
  }

  // Extras
  const rawPlacement: { file: string; q: z.infer<typeof S.PlacementQuestion> }[] = [];
  for (const s of src.extras) {
    const x = parse(S.ExtrasFile, s, schemaErrors);
    if (!x) continue;
    addItems(s.file, x);
    for (const q of x.placement) {
      claim(q.id, "placement", s.file);
      rawPlacement.push({ file: s.file, q });
    }
  }

  // Dialogues
  const dialogues: Dialogue[] = [];
  const rawDialogueUnits: { file: string; id: string; unit?: string }[] = [];
  for (const s of src.dialogues) {
    const d = parse(S.DialogueFile, s, schemaErrors);
    if (!d) continue;
    const where = `${s.file}: dialogue "${d.id}"`;
    claim(d.id, "dialogue", s.file);
    checkSituation(d.situation, where);
    rawDialogueUnits.push({ file: s.file, id: d.id, unit: d.unit });
    const turnIds = new Set<string>();
    const turns: Dialogue["turns"] = d.turns.map((t) => {
      if (turnIds.has(t.id)) errors.push(`${where}: duplicate turn id "${t.id}"`);
      turnIds.add(t.id);
      if (t.speaker === "native") {
        return { ...t, audioKey: audioKey(d.id, t.id), voice: checkVoice(t.voice, `${where} turn "${t.id}"`) };
      }
      if (!t.options.some((o) => o.verdict === "correct")) {
        errors.push(`${where}: learner turn "${t.id}" needs at least one "correct" option`);
      }
      return {
        ...t,
        options: t.options.map((o, i) => ({ ...o, audioKey: audioKey(d.id, t.id, i + 1), voice: defaultVoice })),
      };
    });
    if (!turns.some((t) => t.speaker === "learner")) errors.push(`${where}: needs at least one learner turn`);
    dialogues.push({ ...d, turns });
  }

  // A file that failed its schema was skipped: checking references now would only add
  // misleading "unknown id" errors. Fix the schema errors first.
  if (schemaErrors.length) return { pack: null, errors: [...schemaErrors, ...errors] };

  // References (after everything is registered).
  const allowedInLesson = new Set<string>(S.LESSON_ITEM_KINDS);
  for (const u of units) {
    for (const l of u.lessons) {
      for (const ref of l.items) {
        const kind = kinds.get(ref);
        if (!kind) errors.push(`unit "${u.id}" lesson "${l.id}": unknown item "${ref}"`);
        else if (!allowedInLesson.has(kind)) errors.push(`unit "${u.id}" lesson "${l.id}": "${ref}" is a ${kind}, not a lesson item`);
      }
      if (new Set(l.items).size !== l.items.length) errors.push(`unit "${u.id}" lesson "${l.id}": repeated item`);
    }
  }
  for (const v of vocab) {
    if (v.example && kinds.get(v.example) !== "phrase") errors.push(`vocab "${v.id}": example "${v.example}" is not a phrase id`);
  }
  for (const d of rawDialogueUnits) {
    if (d.unit && kinds.get(d.unit) !== "unit") errors.push(`${d.file}: dialogue "${d.id}": unknown unit "${d.unit}"`);
  }
  for (const { file, q } of rawPlacement) {
    const where = `${file}: placement "${q.id}"`;
    if (q.answer >= q.options.length) errors.push(`${where}: answer ${q.answer} is out of range`);
    for (const l of q.lessons) if (kinds.get(l) !== "lesson") errors.push(`${where}: unknown lesson "${l}"`);
    const { voice, ...rest } = q;
    placement.push({
      ...rest,
      audio: q.text ? { text: q.text, audioKey: audioKey(q.id), voice: checkVoice(voice, where) } : undefined,
    });
  }

  units.sort((a, b) => a.order - b.order);
  dialogues.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  const pack: Pack = { meta, units, dialogues, phrases, vocab, qa, grammar, expressions, placement };
  return { pack: errors.length ? null : pack, errors };
}

/** Counts for the content:check summary. */
export function packStats(p: Pack) {
  return {
    units: p.units.length,
    lessons: p.units.reduce((n, u) => n + u.lessons.length, 0),
    phrases: p.phrases.length,
    vocab: p.vocab.length,
    qa: p.qa.length,
    grammar: p.grammar.length,
    expressions: p.expressions.length,
    dialogues: p.dialogues.length,
    placement: p.placement.length,
  };
}
