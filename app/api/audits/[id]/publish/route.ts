import { requirePerm } from "@/lib/roles";
import { get, update } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { renderDoc } from "@/lib/server/pdf";
import { auditDoc, type AuditRecord } from "@/lib/docs";

/** Lock & publish: generates the PDF, stores its SHA-256 and locks the record against further edits. */
export async function POST(_req: Request, ctx: RouteContext<"/api/audits/[id]/publish">) {
  const gate = await requirePerm("audit");
  if (!gate.ok) return gate.res;
  const { id } = await ctx.params;
  const a = await get<AuditRecord & { locked?: boolean }>("audits", id);
  if (!a) return new Response("Save a draft first", { status: 404 });
  if (!a.signature?.trim()) return new Response("Sign the report before publishing", { status: 400 });
  const published = { ...a, status: "Published" };
  const { pdfHash } = await renderDoc(auditDoc(published));
  const ok = await update("audits", id, { status: "Published", locked: true, sha256: pdfHash, published_at: Date.now(), published_by: gate.session.userId }, [{ field: "locked", ne: true }]);
  await audit(gate.session, "report_publish", id, ok ? "ok" : "refused", ok ? `sha256 ${pdfHash}` : "already locked");
  return ok ? Response.json({ ok, sha256: pdfHash }) : new Response("Already published", { status: 409 });
}
