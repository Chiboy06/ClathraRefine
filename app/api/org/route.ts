import { getSession } from "@/lib/server/auth";
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
  const item = { id: newId(at), created_at: at, ...b.data, user_id: s.userId, user_name: s.name, current_role: s.role, status: "pending" };
  await put("role_requests", item);
  await audit(s, "role_request", b.data.requested_role, "pending", b.data.company);
  return Response.json(item);
}
