import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { TicketBody } from "@/lib/schema/api";
import { list, newId, put } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePerm("read");
  if (!gate.ok) return gate.res;
  return Response.json(await list("tickets", 100));
}

export async function POST(req: Request) {
  const gate = await requirePerm("read", { key: "ticket", max: 5, windowMs: 60_000 });
  if (!gate.ok) return gate.res;
  const b = await parseBody(req, TicketBody);
  if (!b.ok) return b.res;
  const at = Date.now();
  const item = { id: newId(at), created_at: at, ...b.data, status: "Open", by: gate.session.name, by_id: gate.session.userId };
  await put("tickets", item);
  await audit(gate.session, "ticket_submit", item.id, "ok", `${b.data.severity} ${b.data.category}`);
  return Response.json(item);
}
