import { getSession } from "@/lib/server/auth";
import { get, update } from "@/lib/server/db";
import { parseBody } from "@/lib/server/http";
import { OrderStatusBody } from "@/lib/schema/api";
import { audit } from "@/lib/server/audit";

const NEXT: Record<string, string[]> = {
  paid: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
};

/** Seller moves a paid order along. Payment status itself is set only by the verified webhook. */
export async function PATCH(req: Request, ctx: RouteContext<"/api/market/orders/[id]">) {
  const s = await getSession();
  if (!s) return new Response("Sign in required", { status: 401 });
  const { id } = await ctx.params;
  const b = await parseBody(req, OrderStatusBody);
  if (!b.ok) return b.res;
  const o = await get<{ seller_id: string; status: string }>("orders", id);
  if (!o) return new Response("Not found", { status: 404 });
  if (s.role !== "admin" && !(s.role === "seller" && o.seller_id === s.userId)) return new Response("Not your order", { status: 403 });
  if (!NEXT[o.status]?.includes(b.data.status)) return new Response(`Cannot move from ${o.status} to ${b.data.status}`, { status: 409 });
  const ok = await update("orders", id, { status: b.data.status, [`${b.data.status}_at`]: Date.now() }, [{ field: "status", eq: o.status }]);
  await audit(s, "order_status", id, ok ? "ok" : "refused", `${o.status} to ${b.data.status}`);
  return ok ? Response.json({ ok }) : new Response("Order changed, reload", { status: 409 });
}
