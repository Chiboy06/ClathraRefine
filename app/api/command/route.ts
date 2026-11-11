import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { CommandBody } from "@/lib/schema/api";
import { awsEnabled, publishCmd } from "@/lib/server/aws";
import { newId, put } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

/**
 * Manual fan, pump and mode commands (select-before-operate execute step). Operators and supervisors only.
 * The board decides: it applies its interlocks and answers accepted or rejected with a reason on cmd/ack.
 */
export async function POST(req: Request) {
  const gate = await requirePerm("ack", { key: "command", max: 20, windowMs: 60_000 });
  if (!gate.ok) return gate.res;
  const b = await parseBody(req, CommandBody);
  if (!b.ok) return b.res;
  const { cmd, value, mode } = b.data;
  if (mode === "LIVE") {
    if (!awsEnabled() || !process.env.IOT_ENDPOINT) return new Response("Sending commands is not set up: add AWS_ROLE_ARN and IOT_ENDPOINT in Vercel, then redeploy", { status: 503 });
    try {
      await publishCmd({ cmd, value } as Parameters<typeof publishCmd>[0]);
    } catch (e) {
      // 502: the app is fine, AWS refused; the message names the setting to fix.
      return new Response((e as Error).message, { status: 502 });
    }
  }
  const at = Date.now();
  const id = newId(at);
  await put("commands", { id, created_at: at, kind: cmd, value, mode, requested_by: gate.session.userId, requested_name: gate.session.name, status: "sent" });
  await audit(gate.session, `command_${cmd}`, mode === "LIVE" ? "board" : "demo scenario", "ok", `${cmd} ${value} (request ${id})`);
  return Response.json({ request_id: id, at });
}
