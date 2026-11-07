import { list, newId, put } from "@/lib/server/db";
import { getSession } from "@/lib/server/auth";
import { can } from "@/lib/roleMatrix";
import { parseBody } from "@/lib/server/http";
import { ListingBody } from "@/lib/schema/api";
import { audit } from "@/lib/server/audit";
import type { Product } from "@/lib/demoData";

export const dynamic = "force-dynamic";

/** Public catalogue: live listings only. Sellers also see their own drafts; admins see everything. */
export async function GET() {
  const s = await getSession();
  const all = await list<Product>("products", 500);
  const visible = all.filter((p) => p.status === "live" || (s && (s.role === "admin" || p.seller_id === s.userId)));
  return Response.json(visible.sort((a, b) => a.created_at - b.created_at));
}

/** Seller creates a listing from a production lot. Plant staff may create a draft from surplus quota. */
export async function POST(req: Request) {
  const s = await getSession();
  if (!s) return new Response("Sign in required", { status: 401 });
  const seller = can(s.role, "sell");
  if (!seller && !can(s.role, "request_override")) return new Response(`Your role (${s.role}) cannot list products`, { status: 403 });
  const b = await parseBody(req, ListingBody);
  if (!b.ok) return b.res;
  const at = Date.now();
  const d = b.data;
  const item: Product & { id: string } = {
    id: newId(at).replace("#", "-"),
    created_at: at,
    seller_id: s.userId,
    seller_name: s.name,
    title: d.title,
    category: d.category,
    packaging: [{ id: "unit", label: d.packaging_label, price_kobo: d.price_kobo, moq: d.moq }],
    default_qty: d.moq,
    stock: d.stock,
    stock_label: `${d.stock.toLocaleString("en-GB")} available`,
    badges: ["Demo listing"],
    description: d.description,
    specs: [],
    image: "/images/carbonate-drum.svg",
    alt: "Generic illustration of sealed industrial drums",
    status: seller ? "live" : "draft",
    demo: true,
    lot: { lot_id: d.lot_id, site: "Niger Delta Mini-Refinery Complex #04", period: new Date(at).toISOString().slice(0, 7), tag: "FQ-501" },
    secondary: "coa",
  };
  await put("products", item);
  await audit(s, "listing_create", item.id, "ok", `${item.status}: ${d.title}`);
  return Response.json(item);
}
