import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { PingBody } from "@/lib/schema/api";
import { awsEnabled, publishCmd } from "@/lib/server/aws";
import { newId, put } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

/** Sends {"cmd":"ping"}. The client times the round trip from the ack stored in ClathraEvents. */
export async function POST(req: Request) {
  const gate = await requirePerm("read", { key: "ping", max: 20, windowMs: 60_000 });
  if (!gate.ok) return gate.res;
  const b = await parseBody(req, PingBody);
  if (!b.ok) return b.res;
  const at = Date.now();
  if (b.data.mode === "LIVE") {
    if (!awsEnabled()) return new Response("LIVE mode needs AWS", { status: 503 });
    await publishCmd("ping");
  }
  const id = newId(at);
  await put("commands", { id, created_at: at, kind: "ping", mode: b.data.mode, requested_by: gate.session.userId, requested_name: gate.session.name, status: "sent" });
  await audit(gate.session, "ping", b.data.mode === "LIVE" ? "board" : "demo scenario", "ok");
  return Response.json({ request_id: id, sent_at: at });
}
