import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { SiteBody } from "@/lib/schema/api";
import { get, list, put } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePerm("read");
  if (!gate.ok) return gate.res;
  return Response.json(await list("sites", 100));
}

/** Saves the site and device record. Any signed-in user may register their first site; only its owner or an admin may change it. */
export async function POST(req: Request) {
  const gate = await requirePerm("read", { key: "site", max: 10, windowMs: 60_000 });
  if (!gate.ok) return gate.res;
  const b = await parseBody(req, SiteBody);
  if (!b.ok) return b.res;
  if (b.data.region === "af-south-1") return Response.json({ error: "AWS IoT Core is not offered in af-south-1. Use eu-west-1." }, { status: 400 });
  const existing = await get<{ owner?: string }>("sites", b.data.thing);
  if (existing && gate.session.role !== "admin" && existing.owner !== gate.session.userId) return new Response("This device is registered to someone else", { status: 409 });
  const item = { id: b.data.thing, created_at: Date.now(), name: b.data.facility, ...b.data, real: true, owner: existing?.owner ?? gate.session.userId };
  await put("sites", item);
  await audit(gate.session, "site_save", b.data.thing, "ok", `${b.data.facility} in ${b.data.region}`);
  return Response.json(item);
}
