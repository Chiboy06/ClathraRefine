"use client";
import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PackagePlus } from "lucide-react";
import { Badge, Button, Card, Empty, ErrorNote, Field, inputCls, LoadingPanel, Notice, Page, SimTag, Table, Td, postJson, useFetch } from "@/components/ui";
import { Mono, useMe } from "@/components/scada";
import { OrderTrack, useMoney, type Order } from "@/components/market";
import { CATEGORIES, type Product } from "@/lib/demoData";
import { can } from "@/lib/roleMatrix";
import { formatDateTime } from "@/lib/format";
import { CAPTURE_LOTS, lotById } from "@/lib/lots";

const NEXT: Record<string, string> = { paid: "processing", processing: "shipped", shipped: "delivered" };
const LOTS = CAPTURE_LOTS.map((l) => l.lot_id);

function Seller() {
  const fromLot = lotById(useSearchParams().get("lot"));
  const { me } = useMe();
  const money = useMoney();
  const [n, setN] = useState(0);
  const products = useFetch<Product[]>("/api/market/products", [n]);
  const orders = useFetch<Order[]>("/api/market/orders?view=seller", [n]);
  const rfqs = useFetch<{ id: string; rfq_id: string; buyer_name: string; total_kobo: number; status: string; created_at: number }[]>("/api/market/rfq", [n]);
  const [f, setF] = useState(() =>
    fromLot
      ? { ...fromLot.suggested, category: fromLot.category, description: `${fromLot.product} captured at ${fromLot.site}, ${fromLot.from} to ${fromLot.to}.`, lot_id: fromLot.lot_id }
      : { title: "", category: "Recovered Chemicals", description: "", packaging_label: "Per litre", price_naira: 2500, moq: 20, stock: 100, lot_id: LOTS[3] },
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const s = me?.session;
  const mine = (products.data ?? []).filter((p) => p.seller_id === s?.userId || s?.role === "admin");
  const isSeller = can(s?.role, "sell");

  const act = async (key: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      setMsg({ ok: true, t: ok });
      setN((x) => x + 1);
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Page title="Seller centre" subtitle={<>Listings, production lots, incoming orders and RFQs <SimTag kind="Demo" /></>}>
      {!isSeller && s && <Notice tone="neutral">Your role ({s.role}) can view this page. Seller or admin roles can list and fulfil.</Notice>}
      {msg && (msg.ok ? <Notice tone="ok">{msg.t}</Notice> : <ErrorNote>{msg.t}</ErrorNote>)}

      <Card title="Create a listing from a capture lot" actions={<Link href="/app/capture" className="text-sm font-semibold text-primary-fg hover:underline">Browse capture lots</Link>}>
        {fromLot && <p className="mb-4 text-sm text-muted">Started from {fromLot.lot_id}: {fromLot.product}, captured at {fromLot.site}.</p>}
        <form
          className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"
          onSubmit={(e) => {
            e.preventDefault();
            act(
              "create",
              () => postJson("/api/market/products", { ...f, price_kobo: Math.round(f.price_naira * 100) }),
              "Listing created. It shows as a Demo listing in the marketplace.",
            );
          }}
        >
          <Field id="ls-title" label="Title">
            <input id="ls-title" required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className={inputCls} placeholder="Sodium carbonate solution, 1 L" />
          </Field>
          <Field id="ls-cat" label="Category">
            <select id="ls-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={inputCls}>
              {CATEGORIES.slice(1).map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field id="ls-lot" label="Production lot">
            <select id="ls-lot" value={f.lot_id} onChange={(e) => setF({ ...f, lot_id: e.target.value })} className={inputCls}>
              {LOTS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </Field>
          <Field id="ls-pk" label="Packaging">
            <input id="ls-pk" required value={f.packaging_label} onChange={(e) => setF({ ...f, packaging_label: e.target.value })} className={inputCls} />
          </Field>
          <Field id="ls-price" label="Price (₦ per unit)" hint="Stored in kobo on the server">
            <input id="ls-price" type="number" min={1} required value={f.price_naira} onChange={(e) => setF({ ...f, price_naira: Number(e.target.value) })} className={inputCls} />
          </Field>
          <Field id="ls-moq" label="Minimum order">
            <input id="ls-moq" type="number" min={1} required value={f.moq} onChange={(e) => setF({ ...f, moq: Number(e.target.value) })} className={inputCls} />
          </Field>
          <Field id="ls-stock" label="Stock">
            <input id="ls-stock" type="number" min={0} required value={f.stock} onChange={(e) => setF({ ...f, stock: Number(e.target.value) })} className={inputCls} />
          </Field>
          <Field id="ls-desc" label="Description">
            <input id="ls-desc" required value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={inputCls} />
          </Field>
          <div className="md:col-span-2 lg:col-span-4">
            <Button variant="shop" type="submit" disabled={!isSeller} busy={busy === "create"}>
              <PackagePlus aria-hidden className="h-4 w-4" /> Create listing
            </Button>
          </div>
        </form>
      </Card>

      <Card title="My listings">
        {products.loading && <LoadingPanel />}
        {products.error && <ErrorNote>{products.error}</ErrorNote>}
        {products.data && !mine.length && <Empty title="No listings yet" />}
        {!!mine.length && (
          <Table head={["Title", "Lot", "Price", "Stock", "Status", ""]} caption="My listings">
            {mine.map((p) => (
              <tr key={p.id}>
                <Td>{p.title}</Td>
                <Td mono>{p.lot.lot_id}</Td>
                <Td mono>{money(p.packaging[0].price_kobo)}</Td>
                <Td mono>{p.stock}</Td>
                <Td>
                  <Badge tone={p.status === "live" ? "ok" : p.status === "draft" ? "warn" : "neutral"}>{p.status}</Badge>
                </Td>
                <Td>
                  <Button
                    disabled={!isSeller}
                    busy={busy === p.id}
                    onClick={() => act(p.id, () => postJson(`/api/market/products/${encodeURIComponent(p.id)}`, { status: p.status === "live" ? "hidden" : "live" }, "PATCH"), "Listing updated.")}
                  >
                    {p.status === "live" ? "Hide" : "Publish"}
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card title="Incoming orders">
        {orders.loading && <LoadingPanel />}
        {orders.error && <ErrorNote>{orders.error}</ErrorNote>}
        {orders.data && !orders.data.length && <Empty title="No incoming orders" />}
        <div className="flex flex-col gap-4">
          {orders.data?.map((o) => (
            <div key={o.id} className="rounded-md border border-line p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <Mono>{o.id.slice(0, 8)}</Mono> · {o.buyer_email} · {formatDateTime(o.created_at)}
                </span>
                <Mono>{money(o.total_kobo)}</Mono>
              </div>
              <OrderTrack status={o.status} />
              {NEXT[o.status] && (
                <Button className="mt-3" busy={busy === o.id} onClick={() => act(o.id, () => postJson(`/api/market/orders/${o.id}`, { status: NEXT[o.status] }, "PATCH"), "Order moved on.")}>
                  Mark {NEXT[o.status]}
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title="Incoming RFQs">
        {rfqs.data && !rfqs.data.length && <Empty title="No RFQs" />}
        {!!rfqs.data?.length && (
          <Table head={["RFQ", "Buyer", "Indicative total", "Submitted", "Status"]} caption="Incoming RFQs">
            {rfqs.data.map((q) => (
              <tr key={q.id}>
                <Td mono>{q.rfq_id}</Td>
                <Td>{q.buyer_name}</Td>
                <Td mono>{money(q.total_kobo)}</Td>
                <Td mono>{formatDateTime(q.created_at)}</Td>
                <Td>
                  <Badge tone="primary">{q.status}</Badge>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </Page>
  );
}

export default function SellerPage() {
  return (
    <Suspense fallback={<LoadingPanel />}>
      <Seller />
    </Suspense>
  );
}
