import JSZip from "jszip";
import { requirePerm } from "@/lib/roles";
import { list } from "@/lib/server/db";
import { renderDoc } from "@/lib/server/pdf";
import { auditDoc, type AuditRecord } from "@/lib/docs";
import { audit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

/** Batch compliance ZIP: every matching audit PDF plus a manifest of SHA-256 hashes. */
export async function GET(req: Request) {
  const gate = await requirePerm("read");
  if (!gate.ok) return gate.res;
  const q = new URL(req.url).searchParams;
  const std = q.get("standard");
  const from = Number(q.get("from") ?? 0);
  const to = Number(q.get("to") ?? Number.MAX_SAFE_INTEGER);
  const rows = (await list<AuditRecord & { locked?: boolean }>("audits", 500)).filter(
    (a) => (!std || a.standard === std) && a.created_at >= from && a.created_at <= to,
  );
  const zip = new JSZip();
  const manifest = ["audit_id,standard,status,pdf_sha256"];
  for (const a of rows) {
    const r = await renderDoc(auditDoc(a));
    zip.file(`${a.id}.pdf`, r.buf);
    manifest.push(`${a.id},${a.standard},${a.status},${r.pdfHash}`);
  }
  zip.file("manifest.csv", manifest.join("\n"));
  zip.file("README.txt", "Demo compliance export. OSHA 1910 entries are templates (US law). Nigerian references: NUPRC, NMDPRA, NESREA.");
  const buf = await zip.generateAsync({ type: "uint8array" });
  await audit(gate.session, "compliance_zip", std ?? "all", "ok", `${rows.length} reports`);
  return new Response(buf as BodyInit, { headers: { "Content-Type": "application/zip", "Content-Disposition": 'attachment; filename="compliance-batch.zip"' } });
}
