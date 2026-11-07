import { getSession } from "@/lib/server/auth";
import { list } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/** Buyers see their own orders, sellers their incoming orders, admins all. */
export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return new Response("Sign in required", { status: 401 });
  const view = new URL(req.url).searchParams.get("view");
  const all = await list<{ buyer_id: string; seller_id: string }>("orders", 500);
  const rows = s.role === "admin" && view === "all" ? all : all.filter((o) => (view === "seller" ? o.seller_id === s.userId : o.buyer_id === s.userId));
  return Response.json(rows);
}
