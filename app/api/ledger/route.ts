import { list } from "@/lib/server/db";
import { ensureLedger, type LedgerEntry } from "@/lib/server/ledger";
import { verifyChain } from "@/lib/chain";

export const dynamic = "force-dynamic";

/** Public provenance ledger for carbon tokens, with a chain integrity check. */
export async function GET() {
  await ensureLedger();
  const rows = await list<LedgerEntry>("ledger", 500);
  const intact = await verifyChain([...rows].reverse());
  return Response.json({ rows, intact });
}
