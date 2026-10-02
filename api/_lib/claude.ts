/**
 * The one place that calls Claude: structured output (JSON schema from zod), cached stable system
 * prompt, low/medium effort, server-side fallbacks, and `stop_reason` checks before parsing.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { requireAnthropicKey } from "./config";
import { CoachError } from "./http";
import { COACH_MODEL, type TokenUsage } from "./model";

let client: Anthropic | undefined;

export interface StructuredResult<T> {
  data: T;
  /** Model that actually answered (differs from COACH_MODEL after a server-side fallback). */
  model: string;
  usage: TokenUsage;
}

export interface StructuredRequest<T extends z.ZodType> {
  /** Stable across calls (cached): never put per-request data here. */
  system: string;
  user: string;
  schema: T;
  effort: "low" | "medium";
  maxTokens: number;
  /** Called as soon as a response arrives, also when it is then rejected: every call is billed. */
  onUsage: (model: string, usage: TokenUsage) => Promise<unknown>;
}

const failed = (detail: string) =>
  new CoachError(502, "generation_failed", `No he podido preparar la respuesta (${detail}). Inténtalo de nuevo.`);

export async function generateStructured<T extends z.ZodType>(req: StructuredRequest<T>): Promise<StructuredResult<z.infer<T>>> {
  requireAnthropicKey();
  client ??= new Anthropic();
  let response;
  try {
    response = await client.beta.messages.create({
      model: COACH_MODEL,
      max_tokens: req.maxTokens,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: req.user }],
      output_config: { effort: req.effort, format: betaZodOutputFormat(req.schema) },
    });
  } catch (error) {
    if (error instanceof Anthropic.RateLimitError) throw failed("servicio saturado");
    if (error instanceof Anthropic.APIError) {
      console.error("[coach] Anthropic API error", error.status, error.message);
      throw failed(`error ${error.status ?? "de red"}`);
    }
    throw error;
  }
  const u = response.usage;
  const usage: TokenUsage = {
    input: u.input_tokens,
    output: u.output_tokens,
    cacheWrite: u.cache_creation_input_tokens ?? 0,
    cacheRead: u.cache_read_input_tokens ?? 0,
  };
  await req.onUsage(response.model, usage);
  if (response.stop_reason === "refusal") throw failed("rechazada");
  if (response.stop_reason === "max_tokens") throw failed("demasiado larga");
  const text = response.content.flatMap((block) => (block.type === "text" ? [block.text] : [])).join("");
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw failed("formato no válido");
  }
  const parsed = req.schema.safeParse(raw);
  if (!parsed.success) throw failed("formato no válido");
  return { data: parsed.data, model: response.model, usage };
}
