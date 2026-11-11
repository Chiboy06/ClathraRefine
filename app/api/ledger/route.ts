import { list } from "@/lib/server/db";
import { ensureLedger, type LedgerEntry } from "@/lib/server/ledger";
import { verifyChain } from "@/lib/chain";

export const dynamic = "force-dynamic";

/** Public provenance ledger for carbon tokens, with a chain integrity check. */
export async function GET() {
  await ensureLedger();
  // Public route: never expose the buyer's account id from a retirement entry.
  const rows = (await list<LedgerEntry>("ledger", 500)).map((row) => {
    const body = { ...row.body };
    delete body.buyer;
    return { ...row, body };
  });
  const intact = await verifyChain([...rows].reverse());
  return Response.json({ rows, intact });
}
