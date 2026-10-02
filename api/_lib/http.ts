import type { z } from "zod";

/** An error the client sees as `{ error: { code, message } }`; `message` is Spanish UI copy. */
export class CoachError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

export async function readBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new CoachError(400, "bad_request", "La petición no es válida.");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join(".") || "body";
    throw new CoachError(400, "bad_request", `La petición no es válida (${where}).`);
  }
  return parsed.data;
}

type Method = "GET" | "POST" | "PUT";
type Handler = (request: Request) => Promise<Response>;

/** A Vercel Web-standard function (`export default route({ POST })`) with uniform error handling. */
export function route(handlers: Partial<Record<Method, Handler>>): { fetch: (request: Request) => Promise<Response> } {
  return {
    async fetch(request) {
      const handler = handlers[request.method as Method];
      if (!handler) {
        return new Response(JSON.stringify({ error: { code: "method_not_allowed", message: "Método no permitido." } }), {
          status: 405,
          headers: { ...NO_STORE, "Content-Type": "application/json", Allow: Object.keys(handlers).join(", ") },
        });
      }
      try {
        return await handler(request);
      } catch (error) {
        if (error instanceof CoachError) {
          return json({ error: { code: error.code, message: error.message } }, error.status);
        }
        console.error("[coach]", error);
        return json({ error: { code: "internal", message: "Algo ha fallado. Inténtalo de nuevo." } }, 500);
      }
    },
  };
}
