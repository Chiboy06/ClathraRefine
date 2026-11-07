import { requirePerm } from "@/lib/roles";
import { getSession } from "@/lib/server/auth";
import { parseBody } from "@/lib/server/http";
import { RfqBody } from "@/lib/schema/api";
import { list, newId, put } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { priceFromDb } from "@/lib/server/market";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await getSession();
  if (!s) return new Response("Sign in required", { status: 401 });
  const all = await list<{ buyer_id: string; seller_ids: string[] }>("rfqs", 300);
  return Response.json(s.role === "admin" ? all : all.filter((r) => r.buyer_id === s.userId || r.seller_ids?.includes(s.userId)));
}

/** Submit RFQ and lock an escrow slot (planned settlement model; no money moves here). */
export async function POST(req: Request) {
  const gate = await requirePerm("buy", { key: "rfq", max: 10, windowMs: 60_000 });
  if (!gate.ok) return gate.res;
  const b = await parseBody(req, RfqBody);
  if (!b.ok) return b.res;
  const priced = await priceFromDb(b.data.lines, b.data.logistics);
  if (priced.errors.length) return new Response(priced.errors.join("; "), { status: 409 });
  const at = Date.now();
  const id = `RFQ-${at.toString(36).toUpperCase()}`;
  const item = {
    id: newId(at),
    rfq_id: id,
    created_at: at,
    buyer_id: gate.session.userId,
    buyer_name: gate.session.name,
    seller_ids: [...new Set(priced.products.map((p) => p.seller_id))],
    lines: priced.lines,
    logistics: b.data.logistics,
    location: b.data.location,
    note: b.data.note,
    total_kobo: priced.total,
    status: "Submitted",
    escrow_slot: `ESC-${at.toString(36).toUpperCase().slice(-6)}`,
  };
  await put("rfqs", item);
  await audit(gate.session, "rfq_submit", id, "ok", `total ${priced.total} kobo`);
  return Response.json(item);
}
