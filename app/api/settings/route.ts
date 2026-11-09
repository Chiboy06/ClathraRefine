import { z } from "zod";
import { list, put } from "@/lib/server/db";
import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

/** Display settings (exchange rate, display alert lines, site details). Protected ones change through /api/overrides. */
export async function GET() {
  const rows = await list<{ id: string; value: unknown }>("settings", 50);
  return Response.json(Object.fromEntries(rows.map((r) => [r.id, r.value])));
}

const SiteBody = z.object({
  id: z.literal("site"),
  value: z.object({
    plant: z.string().trim().min(1).max(120),
    location: z.string().trim().min(1).max(120),
    device: z.string().trim().min(1).max(128),
    firmware: z.string().trim().max(40),
    sensors: z.string().trim().max(200),
    solventL: z.number().positive().max(10_000),
    solventM: z.number().positive().max(10),
    commissioned: z.string().trim().max(40),
  }),
});

/** Site details are not safety settings: a supervisor or admin saves them directly, and it is audited. */
export async function POST(req: Request) {
  const gate = await requirePerm("approve_override");
  if (!gate.ok) return gate.res;
  const b = await parseBody(req, SiteBody);
  if (!b.ok) return b.res;
  await put("settings", { id: "site", created_at: Date.now(), value: b.data.value });
  await audit(gate.session, "setting_change", "site", "ok", b.data.value.plant);
  return Response.json({ ok: true });
}
