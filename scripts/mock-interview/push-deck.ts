/**
 * Uploads Mi entrevista's private deck (docs/mock-interview.md "Deck").
 *
 *   npm run deck:push -- <path/to/contenido.json>                 upload to https://herlingo.vercel.app
 *   npm run deck:push -- <path> --url=http://localhost:3000       upload to another origin (dev:coach)
 *   npm run deck:push -- <path> --dry                             map + validate only, nothing uploaded
 *
 * Reads the cards file (Spanish keys, kept outside the repo), maps it to `InterviewDeck`, validates
 * it with the server's schema and `PUT`s it to `<origin>/api/coach/deck/` with the owner's access
 * code (`COACH_ACCESS_CODES` + `COACH_OWNER`, from the environment or .env.local; to reach
 * production they must be the production values). `--dry` needs no code.
 *
 * Cards the interview cannot use are skipped and counted: no question (phrase-only cards) or no
 * model answer yet (without one the corrector cannot tell what is true). Optional lists over the
 * deck's limits (phrases, anchors, variants) keep their first items and are counted; the model
 * answer is never cut. Blocks left without cards are dropped.
 *
 * Prints counts only, never card text, codes or the deck: the repo is public and output gets pasted.
 */
import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { z } from "zod";
import { ownerCode } from "../../api/_lib/config.js";
import { DECK_LIMITS, InterviewDeck, type DeckBlock, type DeckCard } from "../../api/_lib/schema.js";

const DEFAULT_ORIGIN = "https://herlingo.vercel.app";
// npm scripts run from the repo root; INIT_CWD is where the command was typed (for a relative path).
const ROOT = process.cwd();
const CALLER_CWD = process.env.INIT_CWD ?? ROOT;

/** "1 card", "2 cards". */
const count = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// ---- Arguments ----

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const urlArg = args.find((a) => a.startsWith("--url="))?.slice("--url=".length);
const unknown = args.filter((a) => a.startsWith("--") && a !== "--dry" && !a.startsWith("--url="));
const paths = args.filter((a) => !a.startsWith("--"));
if (unknown.length || paths.length !== 1) {
  fail("Usage: npm run deck:push -- <path/to/contenido.json> [--url=<origin>] [--dry]");
}
const file = isAbsolute(paths[0]) ? paths[0] : resolve(CALLER_CWD, paths[0]);

let origin = DEFAULT_ORIGIN;
if (urlArg !== undefined) {
  try {
    const url = new URL(urlArg);
    if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error();
    origin = url.origin;
  } catch {
    fail("--url must be an http(s) origin, e.g. --url=http://localhost:3000");
  }
}

// ---- Source file (Spanish keys) ----

const text = z.string();
const optionalText = z.string().nullish();
const list = <T extends z.ZodType>(item: T) => z.array(item).nullish();

const Source = z.object({
  generado: z.string().min(1),
  bloques: z.array(z.object({ id: text, titulo: text, intro: optionalText })),
  tarjetas: z.array(
    z.object({
      id: text,
      bloque: text,
      titulo: text,
      pregunta: optionalText,
      variantes: list(text),
      respuesta: list(z.object({ en: text, es: text })),
      anclas: list(text),
      frases: list(z.object({ en: text, es: text, nota: optionalText })),
      consejo: optionalText,
      pendiente: optionalText,
      segundos: z.number().nullish(),
      // `fuente` (where a fact comes from) stays in the source: not needed by the app.
    }),
  ),
});
type Source = z.infer<typeof Source>;

/** Paths and zod messages only (they never quote the input), at most `max` lines. */
function printIssues(title: string, error: z.ZodError, max = 10): void {
  console.error(title);
  for (const issue of error.issues.slice(0, max)) console.error(`  ${issue.path.join(".") || "(root)"}: ${issue.message}`);
  if (error.issues.length > max) console.error(`  … and ${error.issues.length - max} more`);
}

interface Counts {
  noQuestion: number;
  noAnswer: number;
  trimmed: number;
  emptyBlocks: number;
}

function toDeck(source: Source): { deck: InterviewDeck; counts: Counts } {
  const counts: Counts = { noQuestion: 0, noAnswer: 0, trimmed: 0, emptyBlocks: 0 };
  const cards: DeckCard[] = [];
  for (const c of source.tarjetas) {
    const question = c.pregunta?.trim();
    if (!question) {
      counts.noQuestion++;
      continue;
    }
    const answer = c.respuesta ?? [];
    if (answer.length === 0) {
      counts.noAnswer++;
      continue;
    }
    const variants = c.variantes ?? [];
    const anchors = c.anclas ?? [];
    const phrases = c.frases ?? [];
    if (
      variants.length > DECK_LIMITS.variants ||
      anchors.length > DECK_LIMITS.anchors ||
      phrases.length > DECK_LIMITS.phrases
    ) {
      counts.trimmed++;
    }
    cards.push({
      id: c.id,
      block: c.bloque,
      title: c.titulo,
      question,
      variants: variants.slice(0, DECK_LIMITS.variants),
      answer: answer.map(({ en, es }) => ({ en, es })),
      anchors: anchors.slice(0, DECK_LIMITS.anchors),
      phrases: phrases.slice(0, DECK_LIMITS.phrases).map((p) => ({ en: p.en, es: p.es, ...(p.nota ? { note: p.nota } : {}) })),
      ...(c.consejo?.trim() ? { tip: c.consejo } : {}),
      pending: c.pendiente?.trim() ? c.pendiente : null,
      ...(typeof c.segundos === "number" ? { seconds: c.segundos } : {}),
    });
  }
  const used = new Set(cards.map((card) => card.block));
  const blocks: DeckBlock[] = [];
  for (const b of source.bloques) {
    if (!used.has(b.id)) {
      counts.emptyBlocks++;
      continue;
    }
    blocks.push({ id: b.id, title: b.titulo, ...(b.intro?.trim() ? { intro: b.intro } : {}) });
  }
  return { deck: { version: 1, generated: source.generado, blocks, cards }, counts };
}

// ---- Map and validate ----

if (!existsSync(file)) fail(`Not found: ${file}`);
let raw: unknown;
try {
  raw = JSON.parse(readFileSync(file, "utf8"));
} catch {
  fail(`Not valid JSON: ${file}`);
}
const source = Source.safeParse(raw);
if (!source.success) {
  printIssues("The cards file does not have the expected shape:", source.error);
  process.exit(1);
}

const { deck: mapped, counts } = toDeck(source.data);
const checked = InterviewDeck.safeParse(mapped);
if (!checked.success) {
  printIssues("The deck is not valid (paths are inside the mapped deck):", checked.error);
  process.exit(1);
}
const deck = checked.data;
const body = JSON.stringify(deck);
const bytes = Buffer.byteLength(body);
if (bytes > DECK_LIMITS.bytes) fail(`The deck is ${Math.ceil(bytes / 1024)} KB; the limit is ${DECK_LIMITS.bytes / 1024} KB.`);

const pending = deck.cards.filter((card) => card.pending).length;
console.log(
  `Deck: ${count(deck.blocks.length, "block")}, ${count(deck.cards.length, "card")} (${pending} pending), ${Math.ceil(bytes / 1024)} KB.`,
);
if (counts.noQuestion || counts.noAnswer || counts.emptyBlocks) {
  console.log(
    `Skipped: ${count(counts.noQuestion, "card")} without a question, ${counts.noAnswer} without a model answer; ` +
      `${count(counts.emptyBlocks, "block")} left without cards.`,
  );
}
if (counts.trimmed) {
  console.log(
    `Trimmed: ${count(counts.trimmed, "card")} over the limits (≤ ${DECK_LIMITS.phrases} phrases, ` +
      `≤ ${DECK_LIMITS.anchors} anchors, ≤ ${DECK_LIMITS.variants} variants; the first ones are kept).`,
  );
}
if (dry) {
  console.log("--dry: valid, nothing uploaded.");
  process.exit(0);
}

// ---- Upload ----

async function upload(body: string): Promise<void> {
  const envFile = join(ROOT, ".env.local");
  if (existsSync(envFile)) process.loadEnvFile(envFile); // variables already set win
  const code = ownerCode();
  if (!code) fail("No owner code: set COACH_ACCESS_CODES and COACH_OWNER in .env.local (the owner entry's code).");

  let response: Response;
  try {
    response = await fetch(`${origin}/api/coach/deck/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-coach-code": code },
      body,
    });
  } catch (error) {
    fail(`Could not reach ${origin}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const reply = (await response.json().catch(() => null)) as {
    updatedAt?: string;
    blocks?: number;
    cards?: number;
    error?: { code?: string; message?: string };
  } | null;
  if (!response.ok) {
    const hint =
      response.status === 401
        ? " (the code in .env.local is not one this server knows)"
        : response.status === 403
          ? " (COACH_OWNER's code is not the owner on this server)"
          : "";
    fail(`Upload failed: ${response.status} ${reply?.error?.code ?? ""} ${reply?.error?.message ?? ""}${hint}`.trim());
  }
  console.log(`Uploaded to ${origin}: ${count(reply?.blocks ?? 0, "block")}, ${count(reply?.cards ?? 0, "card")} (${reply?.updatedAt}).`);
}

upload(body).catch((error: unknown) => fail(`Upload failed: ${error instanceof Error ? error.message : String(error)}`));
