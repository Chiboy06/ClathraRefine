import { z } from "zod";
import { get, update } from "@/lib/server/db";
import { getSession } from "@/lib/server/auth";
import { parseBody } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";
import type { Product } from "@/lib/demoData";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/market/products/[id]">) {
  const { id } = await ctx.params;
  const p = await get<Product>("products", id);
  if (!p) return new Response("Not found", { status: 404 });
  const s = await getSession();
  if (p.status !== "live" && !(s && (s.role === "admin" || s.userId === p.seller_id))) return new Response("Not found", { status: 404 });
  return Response.json(p);
}

/** Moderation (admin) or the seller publishing/hiding their own listing. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/market/products/[id]">) {
  const s = await getSession();
  if (!s) return new Response("Sign in required", { status: 401 });
  const { id } = await ctx.params;
  const b = await parseBody(req, z.object({ status: z.enum(["live", "hidden", "draft"]) }));
  if (!b.ok) return b.res;
  const p = await get<Product>("products", id);
  if (!p) return new Response("Not found", { status: 404 });
  if (s.role !== "admin" && !(s.role === "seller" && s.userId === p.seller_id)) return new Response("Not your listing", { status: 403 });
  await update("products", id, { status: b.data.status });
  await audit(s, "listing_status", id, "ok", b.data.status);
  return Response.json({ ok: true });
}
