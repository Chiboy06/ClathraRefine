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
    if (!awsEnabled() || !process.env.IOT_ENDPOINT) return new Response("Sending commands is not set up: add AWS_ROLE_ARN and IOT_ENDPOINT in Vercel, then redeploy", { status: 503 });
    try {
      await publishCmd("ping");
    } catch (e) {
      // 502: the app is fine, AWS refused; the message names the setting to fix.
      return new Response((e as Error).message, { status: 502 });
    }
  }
  const id = newId(at);
  await put("commands", { id, created_at: at, kind: "ping", mode: b.data.mode, requested_by: gate.session.userId, requested_name: gate.session.name, status: "sent" });
  await audit(gate.session, "ping", b.data.mode === "LIVE" ? "board" : "demo scenario", "ok");
  return Response.json({ request_id: id, sent_at: at });
}
