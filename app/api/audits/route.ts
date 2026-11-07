import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { AuditDraftBody } from "@/lib/schema/api";
import { get, list, put, update } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { renderDoc } from "@/lib/server/pdf";
import { auditDoc, type AuditRecord } from "@/lib/docs";

export const dynamic = "force-dynamic";

export async function GET() {
  const gate = await requirePerm("read");
  if (!gate.ok) return gate.res;
  const rows = await list<AuditRecord & { sha256: string | null; locked: boolean }>("audits", 200);
  // Seeded published audits get their real PDF hash on first listing.
  for (const r of rows) {
    if (r.locked && !r.sha256) {
      r.sha256 = (await renderDoc(auditDoc(r))).pdfHash;
      await update("audits", r.id, { sha256: r.sha256 });
    }
  }
  return Response.json(rows.sort((a, b) => b.created_at - a.created_at));
}

/** Save draft. Refused once the audit is locked. */
export async function POST(req: Request) {
  const gate = await requirePerm("audit");
  if (!gate.ok) return gate.res;
  const b = await parseBody(req, AuditDraftBody);
  if (!b.ok) return b.res;
  const cur = await get<AuditRecord & { locked?: boolean }>("audits", b.data.id);
  if (cur?.locked) return new Response("Audit is locked", { status: 409 });
  const item = {
    standard: "ISO 14064",
    auditor: gate.session.name,
    unit: "Gas Sweetening Scrubber",
    score: 98.4,
    status: "Draft",
    created_at: Date.now(),
    ...cur,
    ...b.data,
    locked: false,
    sha256: null,
    updated_at: Date.now(),
  };
  await put("audits", item);
  await audit(gate.session, "audit_save_draft", b.data.id, "ok");
  return Response.json(item);
}
