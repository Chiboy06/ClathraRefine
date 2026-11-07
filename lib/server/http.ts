import "server-only";
import type { z } from "zod";

/** Validate a JSON body at the trust boundary. */
export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: Response }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { ok: false, res: new Response("Body must be JSON", { status: 400 }) };
  }
  const r = schema.safeParse(raw);
  if (!r.success) return { ok: false, res: Response.json({ error: r.error.issues.map((i) => i.message).join("; ") }, { status: 400 }) };
  return { ok: true, data: r.data };
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });
