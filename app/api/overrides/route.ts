import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { OverrideBody } from "@/lib/schema/api";
import { list, newId, put } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const gate = await requirePerm("read");
  if (!gate.ok) return gate.res;
  const all = await list("commands", 300);
  // ?view=commands returns SCRAM and ping history for the device page; default is override requests.
  const commands = new URL(req.url).searchParams.get("view") === "commands";
  return Response.json(all.filter((c) => (c.kind === "scram" || c.kind === "ping") === commands));
}

/** Records an override request. It does nothing until a second, different supervisor approves it. */
export async function POST(req: Request) {
  const gate = await requirePerm("request_override", { key: "override", max: 10, windowMs: 60_000 });
  if (!gate.ok) return gate.res;
  const b = await parseBody(req, OverrideBody);
  if (!b.ok) return b.res;
  const s = gate.session;
  const at = Date.now();
  const id = newId(at);
  const item = { id, created_at: at, ...b.data, requested_by: s.userId, requested_name: s.name, requested_role: s.role, status: "pending" };
  await put("commands", item);
  await audit(s, `request_${b.data.kind}`, `${b.data.target}=${b.data.value}`, "pending", `${b.data.reason} (request ${id})`);
  return Response.json(item);
}
