import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { ShiftAcceptBody, ShiftBody } from "@/lib/schema/api";
import { list, newId, put, update } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePerm("read");
  if (!gate.ok) return gate.res;
  return Response.json(await list("shift", 200));
}

export async function POST(req: Request) {
  const gate = await requirePerm("ack");
  if (!gate.ok) return gate.res;
  const b = await parseBody(req, ShiftBody);
  if (!b.ok) return b.res;
  const at = Date.now();
  const item = { id: newId(at), created_at: at, ...b.data, author: gate.session.name, author_id: gate.session.userId };
  await put("shift", item);
  await audit(gate.session, b.data.handover ? "shift_handover" : "shift_note", item.id, "ok");
  return Response.json(item);
}

/** Incoming shift signs off a handover. The author cannot accept their own handover. */
export async function PATCH(req: Request) {
  const gate = await requirePerm("ack");
  if (!gate.ok) return gate.res;
  const b = await parseBody(req, ShiftAcceptBody);
  if (!b.ok) return b.res;
  const ok = await update("shift", b.data.id, { accepted_by: gate.session.name, accepted_at: Date.now() }, [
    { field: "handover", eq: true },
    { field: "author_id", ne: gate.session.userId },
  ]);
  await audit(gate.session, "shift_accept", b.data.id, ok ? "ok" : "refused");
  return ok ? Response.json({ ok }) : new Response("Only another person can accept a handover", { status: 409 });
}
