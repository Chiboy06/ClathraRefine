import { clerkClient } from "@clerk/nextjs/server";
import { requirePerm } from "@/lib/roles";
import { parseBody } from "@/lib/server/http";
import { CartBody } from "@/lib/schema/api";
import { put } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { clerkEnabled } from "@/lib/server/auth";
import { priceFromDb } from "@/lib/server/market";

/** Paystack test-mode checkout with a seller subaccount split (guide 8.5). */
export async function POST(req: Request) {
  const gate = await requirePerm("buy", { key: "checkout", max: 5, windowMs: 60_000 });
  if (!gate.ok) return gate.res;
  const s = gate.session;
  const b = await parseBody(req, CartBody);
  if (!b.ok) return b.res;
  if (!process.env.PAYSTACK_SECRET_KEY) return new Response("Paystack test key is not set on the server", { status: 503 });
  if (!process.env.PAYSTACK_SECRET_KEY.startsWith("sk_test_")) return new Response("Only Paystack test mode is allowed", { status: 503 });
  if (!s.email) return new Response("No email on account", { status: 400 });

  const priced = await priceFromDb(b.data.lines, b.data.logistics);
  if (priced.errors.length) return new Response(priced.errors.join("; "), { status: 409 });
  const sellers = new Set(priced.products.map((p) => p.seller_id));
  if (sellers.size !== 1) return new Response("One seller per checkout", { status: 400 });
  const seller_id = [...sellers][0];

  let subaccount = process.env.PAYSTACK_DEMO_SUBACCOUNT;
  if (clerkEnabled() && !seller_id.startsWith("demo-")) {
    const seller = await (await clerkClient()).users.getUser(seller_id);
    subaccount = (seller.publicMetadata as { seller_subaccount?: string }).seller_subaccount;
  }
  if (!subaccount) return new Response("Seller not set up for payment", { status: 400 });

  const order_id = crypto.randomUUID();
  const created_at = Date.now();
  await put("orders", {
    id: order_id,
    created_at,
    buyer_id: s.userId,
    buyer_email: s.email,
    seller_id,
    items: priced.lines,
    logistics: b.data.logistics,
    location: b.data.location,
    subtotal_kobo: priced.subtotal,
    vat_kobo: priced.vat,
    esg_credit_kobo: priced.esgCredit,
    logistics_kobo: priced.logistics,
    total_kobo: priced.total,
    status: "pending_payment",
  });

  const ps = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: s.email,
      amount: priced.total,
      reference: order_id,
      subaccount,
      bearer: "account",
      callback_url: `${new URL(req.url).origin}/marketplace/orders`,
      metadata: { order_id },
    }),
  })
    .then((r) => r.json())
    .catch(() => ({ status: false }));

  await audit(s, "checkout_start", order_id, ps.status ? "ok" : "refused", `total ${priced.total} kobo`);
  if (!ps.status) return new Response("Payment could not start", { status: 502 });
  return Response.json({ authorization_url: ps.data.authorization_url, order_id });
}
