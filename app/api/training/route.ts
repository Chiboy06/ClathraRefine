import { z } from "zod";
import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { list, newId, put } from "@/lib/server/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePerm("read");
  if (!gate.ok) return gate.res;
  return Response.json(await list("training", 50));
}

/** Records a trainee's score for the training scenario. */
export async function POST(req: Request) {
  const gate = await requirePerm("read", { key: "training", max: 20, windowMs: 60_000 });
  if (!gate.ok) return gate.res;
  const b = await parseBody(req, z.object({ scenario: z.string().max(60), score: z.number().int().min(0).max(10), total: z.number().int().min(1).max(10) }));
  if (!b.ok) return b.res;
  const at = Date.now();
  const item = { id: newId(at), created_at: at, ...b.data, trainee: gate.session.name, trainee_id: gate.session.userId };
  await put("training", item);
  return Response.json(item);
}
