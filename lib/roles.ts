import "server-only";
import { can, type Permission } from "./roleMatrix";
import { getSession, type Session } from "./server/auth";
import { rateLimit } from "./server/rateLimit";

export type Gate = { ok: true; session: Session } | { ok: false; res: Response };

/** Server-side role check every API route and server action uses. */
export async function requirePerm(p: Permission, limit?: { key: string; max: number; windowMs: number }): Promise<Gate> {
  const session = await getSession();
  if (!session) return { ok: false, res: new Response("Sign in required", { status: 401 }) };
  if (!can(session.role, p)) return { ok: false, res: new Response(`Your role (${session.role}) cannot do this`, { status: 403 }) };
  if (limit && !rateLimit(`${limit.key}:${session.userId}`, limit.max, limit.windowMs)) {
    return { ok: false, res: new Response("Too many requests, wait a minute", { status: 429 }) };
  }
  return { ok: true, session };
}
