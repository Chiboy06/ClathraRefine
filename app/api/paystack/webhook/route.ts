import crypto from "node:crypto";
import { get, update } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { appendLedger } from "@/lib/server/ledger";
import type { PricedLine } from "@/lib/cart";

/** An order is Paid only after a valid signature AND a verify call with a matching amount (guide 8.6). */
export async function POST(req: Request) {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) return new Response(null, { status: 503 });
  const raw = await req.text();
  const expected = crypto.createHmac("sha512", key).update(raw).digest("hex");
  const given = req.headers.get("x-paystack-signature") ?? "";
  if (given.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
    return new Response(null, { status: 401 });
  }

  let event: { event?: string; data?: { reference?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response(null, { status: 400 });
  }
  if (event.event !== "charge.success" || typeof event.data?.reference !== "string") return new Response(null, { status: 200 });
  const reference = event.data.reference;

  const v = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${key}` },
  })
    .then((r) => r.json())
    .catch(() => null);

  const order = await get<{ total_kobo: number; items: PricedLine[]; buyer_id: string }>("orders", reference);
  if (!order || v?.data?.status !== "success" || v?.data?.amount !== order.total_kobo) {
    await audit(null, "payment_verify", reference, "refused", "amount or status mismatch");
    return new Response(null, { status: 200 });
  }

  // Condition makes a repeated webhook harmless: only the first one moves the order and the stock.
  const first = await update("orders", reference, { status: "paid", paystack_reference: reference, paid_at: Date.now() }, [{ field: "status", eq: "pending_payment" }]);
  if (first) {
    for (const it of order.items) {
      const p = await get<{ stock: number; category: string }>("products", it.productId);
      // shortcut: read-then-write, not an atomic decrement; use "SET stock = stock - :q" if sales get concurrent.
      if (p) await update("products", it.productId, { stock: +(p.stock - it.stock_use).toFixed(3) }, [{ field: "stock", eq: p.stock }, { field: "stock", gte: it.stock_use }]);
      if (p?.category === "Carbon Offsets (VCS)") await appendLedger({ type: "retire", order_id: reference, tokens: it.qty, buyer: order.buyer_id });
    }
    await audit(null, "payment_paid", reference, "ok", `${order.total_kobo} kobo`);
  }
  return new Response(null, { status: 200 });
}
