import { readFile } from "node:fs/promises";
import path from "node:path";
import { requirePerm } from "@/lib/roles";

export const dynamic = "force-dynamic";

/** The trained model from `python train_models.py` (guide 7.3), copied to lib/model.json. 404 until it exists. */
export async function GET() {
  const gate = await requirePerm("read");
  if (!gate.ok) return gate.res;
  try {
    const raw = await readFile(path.join(process.cwd(), "lib", "model.json"), "utf8");
    return new Response(raw, { headers: { "Content-Type": "application/json" } });
  } catch {
    return new Response("No trained model yet", { status: 404 });
  }
}
