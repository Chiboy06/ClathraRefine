import { getSession, clerkEnabled } from "@/lib/server/auth";
import { parseBody } from "@/lib/server/http";
import { OrgBody } from "@/lib/schema/api";
import { newId, put } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

/** Organisation setup after sign-up. Users stay viewer until an admin approves the requested role. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return new Response("Sign in required", { status: 401 });
  const b = await parseBody(req, OrgBody);
  if (!b.ok) return b.res;
  const at = Date.now();
  const id = newId(at);
  // A first request founds the organisation: its id becomes the orgId, so the request is visible to that org's admins.
  const orgId = s.orgId ?? id;
  const item = { id, created_at: at, ...b.data, user_id: s.userId, user_name: s.name, orgId, current_role: s.role, status: "pending" };
  await put("role_requests", item);
  await audit(s, "role_request", b.data.requested_role, "pending", b.data.company);
  // If this is the user's first org setup, write orgId to their Clerk metadata
  if (s.orgId === undefined && clerkEnabled()) {
    const { clerkClient } = await import("@clerk/nextjs/server");
    const c = await clerkClient();
    const u = await c.users.getUser(s.userId);
    await c.users.updateUserMetadata(s.userId, { publicMetadata: { ...(u.publicMetadata as object), orgId } });
  }
  return Response.json(item);
}
