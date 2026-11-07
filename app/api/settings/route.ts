import { list } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Public display settings (exchange rate, display alert lines). Changing them goes through /api/overrides. */
export async function GET() {
  const rows = await list<{ id: string; value: number }>("settings", 50);
  return Response.json(Object.fromEntries(rows.map((r) => [r.id, r.value])));
}
