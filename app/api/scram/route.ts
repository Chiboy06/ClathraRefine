import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { ScramBody } from "@/lib/schema/api";
import { awsEnabled, publishCmd } from "@/lib/server/aws";
import { newId, put } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

// SCRAM is the safe action: one confirmed click for an operator or above (guide correction 14).
// LIVE publishes {"cmd":"scram"}; the UI confirms from the board's own telemetry, not from this response.
export async function POST(req: Request) {
  const gate = await requirePerm("scram", { key: "scram", max: 10, windowMs: 60_000 });
  if (!gate.ok) {
    if (gate.res.status === 403) await audit(null, "scram", "board", "refused", "role not allowed");
    return gate.res;
  }
  const b = await parseBody(req, ScramBody);
  if (!b.ok) return b.res;
  const s = gate.session;
  const at = Date.now();
  const id = newId(at);
  if (b.data.mode === "LIVE") {
    if (!awsEnabled() || !process.env.IOT_ENDPOINT) return new Response("Sending commands is not set up: add AWS_ROLE_ARN and IOT_ENDPOINT in Vercel, then redeploy", { status: 503 });
    await publishCmd("scram");
  }
  await put("commands", { id, created_at: at, kind: "scram", mode: b.data.mode, requested_by: s.userId, requested_name: s.name, status: "sent" });
  await audit(s, "scram", b.data.mode === "LIVE" ? "board" : "demo scenario", "ok", `request ${id}`);
  return Response.json({ request_id: id, at });
}
