/**
 * The one place that calls Claude: structured output (JSON schema from zod), cached stable system
 * prompt, low/medium effort, server-side fallbacks, `stop_reason` checks before parsing, and an
 * optional normalizer that trims recoverable overflows before the zod check.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { requireAnthropicKey } from "./config.js";
import { CoachError } from "./http.js";
import { COACH_MODEL, type Charge } from "./model.js";

let client: Anthropic | undefined;

/**
 * Whole call, SDK retries included: the functions are stopped at 60 s (vercel.json). A request may
 * set its own `deadlineMs` (episodes: 55 s); it must leave a few seconds for the ledger and the reply.
 */
const DEADLINE_MS = 50_000;

export interface StructuredRequest<T extends z.ZodType> {
  /** Stable across calls (cached): never put per-request data here. */
  system: string;
  user: string;
  schema: T;
  effort: "low" | "medium";
  maxTokens: number;
  /** Deadline of the whole call in ms; default `DEADLINE_MS` (50 s). */
  deadlineMs?: number;
  /** Fixes recoverable overflows in the parsed JSON before the zod check (normalize.ts); logs what it changed. */
  normalize?: (raw: unknown) => unknown;
  /** Called as soon as a response arrives, also when it is then rejected: every call is billed. */
  onUsage: (charges: Charge[]) => Promise<unknown>;
}

type Reason = "refusal" | "max_tokens" | "invalid" | "timeout" | "busy" | "api";

const MESSAGES: Record<Reason, string> = {
  refusal: "No puedo preparar esto. Prueba a contarlo de otra forma.",
  max_tokens: "La respuesta ha salido demasiado larga. Inténtalo de nuevo.",
  invalid: "La respuesta ha llegado con errores. Inténtalo de nuevo.",
  timeout: "La IA ha tardado demasiado. Inténtalo de nuevo.",
  busy: "La IA está saturada ahora mismo. Inténtalo en unos minutos.",
  api: "No he podido hablar con la IA. Inténtalo de nuevo.",
};

const failed = (reason: Reason) => new CoachError(502, "generation_failed", MESSAGES[reason]);

/**
 * Tokens per model attempt. Top-level `usage` covers only the attempt that produced the message,
 * so a response served by a fallback model is billed from `usage.iterations`.
 */
function chargesOf(response: Anthropic.Beta.Messages.BetaMessage): Charge[] {
  const iterations = response.usage.iterations ?? [];
  if (iterations.some((it) => it.type === "fallback_message")) {
    return iterations.flatMap((it) =>
      it.type === "message" || it.type === "fallback_message"
        ? [
            {
              model: it.model ?? COACH_MODEL,
              usage: {
                input: it.input_tokens,
                output: it.output_tokens,
                cacheWrite: it.cache_creation_input_tokens,
                cacheRead: it.cache_read_input_tokens,
              },
            },
          ]
        : [],
    );
  }
  const u = response.usage;
  return [
    {
      model: response.model,
      usage: {
        input: u.input_tokens,
        output: u.output_tokens,
        cacheWrite: u.cache_creation_input_tokens ?? 0,
        cacheRead: u.cache_read_input_tokens ?? 0,
      },
    },
  ];
}

export async function generateStructured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<z.infer<T>> {
  requireAnthropicKey();
  client ??= new Anthropic();
  let response;
  try {
    response = await client.beta.messages.create(
      {
        model: COACH_MODEL,
        max_tokens: req.maxTokens,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: req.user }],
        output_config: { effort: req.effort, format: betaZodOutputFormat(req.schema) },
      },
      { signal: AbortSignal.timeout(req.deadlineMs ?? DEADLINE_MS) },
    );
  } catch (error) {
    if (error instanceof Anthropic.APIUserAbortError || error instanceof Anthropic.APIConnectionTimeoutError) {
      console.error("[coach] Claude call timed out");
      throw failed("timeout");
    }
    if (error instanceof Anthropic.APIError) {
      console.error("[coach] Anthropic API error", error.status, error.message);
      throw failed(error instanceof Anthropic.RateLimitError || error.status === 529 ? "busy" : "api");
    }
    throw error;
  }
  await req.onUsage(chargesOf(response));
  if (response.stop_reason === "refusal") {
    console.error("[coach] refusal", response.model, response.stop_details?.category ?? null);
    throw failed("refusal");
  }
  if (response.stop_reason === "max_tokens") {
    console.error("[coach] max_tokens", response.model, response.usage.output_tokens);
    throw failed("max_tokens");
  }
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    console.error("[coach] output is not JSON", response.model, text.length);
    throw failed("invalid");
  }
  const parsed = req.schema.safeParse(req.normalize ? req.normalize(raw) : raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    console.error("[coach] output does not match the schema", issue?.path.join("."), issue?.message);
    throw failed("invalid");
  }
  return parsed.data;
}
