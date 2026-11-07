import { requirePerm } from "@/lib/roles";
import { get, put, type Coll } from "@/lib/server/db";
import { seedFor } from "@/lib/demoData";
import { audit } from "@/lib/server/audit";

/** Loads the Demo catalogue, settings, sites and audit history into an empty DynamoDB store. Skips existing items. */
export async function POST() {
  const gate = await requirePerm("admin");
  if (!gate.ok) return gate.res;
  let added = 0;
  for (const coll of ["products", "settings", "sites", "audits", "tickets", "shift"] as Coll[]) {
    for (const item of seedFor(coll) as { id: string; created_at: number }[]) {
      if (!(await get(coll, item.id))) {
        await put(coll, item);
        added++;
      }
    }
  }
  await audit(gate.session, "seed_demo_data", "store", "ok", `${added} items`);
  return Response.json({ added });
}
