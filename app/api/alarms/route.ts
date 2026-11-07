import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { AlarmActionBody } from "@/lib/schema/api";
import { list, newId, put } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePerm("read");
  if (!gate.ok) return gate.res;
  return Response.json(await list("alarm_actions", 200));
}

/** Software acknowledge and shelve. This never touches the board: its trip resets only with the physical ACK button. */
export async function POST(req: Request) {
  const gate = await requirePerm("ack", { key: "alarm", max: 60, windowMs: 60_000 });
  if (!gate.ok) return gate.res;
  const b = await parseBody(req, AlarmActionBody);
  if (!b.ok) return b.res;
  const at = Date.now();
  const item = { id: newId(at), created_at: at, ...b.data, by: gate.session.userId, by_name: gate.session.name };
  await put("alarm_actions", item);
  await audit(gate.session, `alarm_${b.data.action}`, b.data.alarm_id, "ok", b.data.action === "shelve" ? `${b.data.reason} until ${new Date(b.data.until).toISOString()}` : undefined);
  return Response.json(item);
}
