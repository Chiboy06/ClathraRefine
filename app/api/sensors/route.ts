import { z } from "zod";
import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { list, put } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";
const THING = process.env.THING_NAME || "ESP32S3-N16R8-HARNESS-01";

export async function GET() {
  const gate = await requirePerm("read");
  if (!gate.ok) return gate.res;
  return Response.json(await list("sensors", 20));
}

/** Stores an MQ-135 calibration (R0 from a fresh-air run). Convex ingest reads it by key `<thing>:<sensor>`. */
export async function POST(req: Request) {
  const gate = await requirePerm("approve_override", { key: "calibrate", max: 10, windowMs: 60_000 });
  if (!gate.ok) return gate.res;
  const b = await parseBody(req, z.object({ sensor: z.enum(["co2_in", "co2_out"]), r0Kohm: z.number().positive().max(10_000), rlKohm: z.number().positive().max(1000).default(10), vcMv: z.number().positive().max(6000).default(5000), samples: z.number().int().min(10) }));
  if (!b.ok) return b.res;
  const at = Date.now();
  const item = { id: `${THING}:${b.data.sensor}`, created_at: at, calibrated_at: at, by: gate.session.name, ...b.data };
  await put("sensors", item);
  await audit(gate.session, "sensor_calibrate", item.id, "ok", `R0 ${b.data.r0Kohm.toFixed(2)} kΩ from ${b.data.samples} samples`);
  return Response.json(item);
}
