import { clerkClient } from "@clerk/nextjs/server";
import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { RoleChangeBody } from "@/lib/schema/api";
import { list, put, update } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { clerkEnabled } from "@/lib/server/auth";
import { DEMO_USERS } from "@/lib/demoData";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePerm("admin");
  if (!gate.ok) return gate.res;
  const orgId = gate.session.orgId;
  // Only show role requests for this org
  const allRequests = await list("role_requests", 200);
  const requests = orgId ? allRequests.filter((r: Record<string, unknown>) => r.orgId === orgId) : allRequests;
  let users: { id: string; name: string; email?: string; role: string }[];
  if (clerkEnabled()) {
    const res = await (await clerkClient()).users.getUserList({ limit: 100 });
    // Only show users belonging to this org
    users = res.data
      .filter((u) => !orgId || (u.publicMetadata as { orgId?: string }).orgId === orgId)
      .map((u) => ({
        id: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || u.id,
        email: u.primaryEmailAddress?.emailAddress,
        role: String((u.publicMetadata as { role?: string }).role ?? "viewer"),
      }));
  } else {
    const overrides = await list<{ id: string; role: string }>("user_roles", 100);
    users = DEMO_USERS.map((u) => ({ ...u, role: overrides.find((o) => o.id === u.id)?.role ?? u.role }));
  }
  return Response.json({ users, requests });
}

/** Role change. Admin only; written to the audit log. */
export async function POST(req: Request) {
  const gate = await requirePerm("admin");
  if (!gate.ok) return gate.res;
  const b = await parseBody(req, RoleChangeBody);
  if (!b.ok) return b.res;
  if (b.data.userId === gate.session.userId) return new Response("You cannot change your own role", { status: 409 });
  if (clerkEnabled()) {
    const c = await clerkClient();
    const u = await c.users.getUser(b.data.userId);
    // Enforce: admin can only change roles within their own org
    const targetOrgId = (u.publicMetadata as { orgId?: string }).orgId;
    if (gate.session.orgId && targetOrgId !== gate.session.orgId) {
      return new Response("User is not in your organisation", { status: 403 });
    }
    await c.users.updateUserMetadata(b.data.userId, { publicMetadata: { ...u.publicMetadata, role: b.data.role } });
  } else {
    await put("user_roles", { id: b.data.userId, created_at: Date.now(), role: b.data.role });
  }
  if (b.data.request_id) await update("role_requests", b.data.request_id, { status: "approved", approved_by: gate.session.userId });
  await audit(gate.session, "role_change", b.data.userId, "ok", `to ${b.data.role}`);
  return Response.json({ ok: true });
}
