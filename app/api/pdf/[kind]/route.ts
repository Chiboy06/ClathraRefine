import { renderDoc, pdfResponse } from "@/lib/server/pdf";
import { LIBRARY, coaDoc, specDoc, proformaDoc, reportDoc, auditDoc, type AuditRecord } from "@/lib/docs";
import { get } from "@/lib/server/db";
import { getSession } from "@/lib/server/auth";
import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { CartBody } from "@/lib/schema/api";
import { priceFromDb } from "@/lib/server/market";
import { LOGISTICS, type Product } from "@/lib/demoData";
import { audit } from "@/lib/server/audit";

export const dynamic = "force-dynamic";

/** GET documents: coa, spec, library, report, audit. */
export async function GET(req: Request, ctx: RouteContext<"/api/pdf/[kind]">) {
  const { kind } = await ctx.params;
  const q = new URL(req.url).searchParams;
  if (kind === "coa" || kind === "spec") {
    const p = await get<Product>("products", q.get("product") ?? "");
    if (!p || p.status !== "live") return new Response("Not found", { status: 404 });
    return pdfResponse(await renderDoc(kind === "coa" ? coaDoc(p) : specDoc(p)), `${kind}-${p.id}.pdf`);
  }
  if (kind === "library") {
    const d = LIBRARY[q.get("doc") ?? ""];
    if (!d) return new Response("Not found", { status: 404 });
    return pdfResponse(await renderDoc(d), `${q.get("doc")}.pdf`);
  }
  const gate = await requirePerm("read");
  if (!gate.ok) return gate.res;
  if (kind === "report") {
    const period = q.get("period") === "weekly" ? "weekly" : "daily";
    return pdfResponse(await renderDoc(reportDoc(period)), `report-${period}.pdf`);
  }
  if (kind === "audit") {
    const a = await get<AuditRecord>("audits", q.get("id") ?? "");
    if (!a) return new Response("Not found", { status: 404 });
    return pdfResponse(await renderDoc(auditDoc(a)), `${a.id}.pdf`);
  }
  return new Response("Unknown document", { status: 404 });
}

/** POST proforma: priced on the server from the product database. */
export async function POST(req: Request, ctx: RouteContext<"/api/pdf/[kind]">) {
  const { kind } = await ctx.params;
  if (kind !== "proforma") return new Response("Unknown document", { status: 404 });
  const s = await getSession();
  if (!s) return new Response("Sign in required", { status: 401 });
  const b = await parseBody(req, CartBody);
  if (!b.ok) return b.res;
  const priced = await priceFromDb(b.data.lines, b.data.logistics);
  if (priced.errors.length) return new Response(priced.errors.join("; "), { status: 409 });
  const doc = await renderDoc(proformaDoc(priced, s.name, b.data.location, LOGISTICS.find((l) => l.id === b.data.logistics)!.label));
  await audit(s, "proforma_generate", doc.pdfHash.slice(0, 16), "ok", `total ${priced.total} kobo`);
  return pdfResponse(doc, "proforma-invoice.pdf");
}
