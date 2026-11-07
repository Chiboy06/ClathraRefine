import { requirePerm } from "@/lib/roles";
import { list } from "@/lib/server/db";
import { verifyChain } from "@/lib/chain";
import type { AuditEntry } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePerm("read");
  if (!gate.ok) return gate.res;
  const rows = await list<AuditEntry>("audit_log", 500);
  const chronological = [...rows].reverse();
  const intact = await verifyChain(
    chronological.map(({ prev, hash, created_at, actor, actor_name, role, action, target, outcome, detail }) => ({
      prev,
      hash,
      body: { created_at, actor, actor_name, role, action, target, outcome, detail },
    })),
  );
  return Response.json({ rows, intact });
}
