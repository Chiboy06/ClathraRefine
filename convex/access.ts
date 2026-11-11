import type { QueryCtx, MutationCtx, ActionCtx } from "./_generated/server";
import { can, isRole, type Permission } from "../lib/roleMatrix";

/** Role check for every public Convex function. The role comes from the Clerk JWT "role" claim. */
export async function requirePerm(ctx: QueryCtx | MutationCtx | ActionCtx, p: Permission) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Sign in required");
  const role = isRole(identity.role) ? identity.role : "viewer";
  if (!can(role, p)) throw new Error(`Your role (${role}) cannot do this`);
  return { userId: identity.subject, role };
}

/** Server-to-server calls from the Next.js API (which has already checked the user's role) carry a shared key. */
export function requireServer(key: string) {
  const expected = process.env.SERVER_KEY ?? process.env.CONVEX_SERVER_KEY;
  if (!expected || key.length !== expected.length) throw new Error("Forbidden");
  let diff = 0;
  for (let i = 0; i < key.length; i++) diff |= key.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff) throw new Error("Forbidden");
}
