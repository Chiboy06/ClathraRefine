"use client";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Check, CreditCard, FileDown, FileText, Link2, Lock, Minus, Plus, ShieldCheck, ShoppingCart, Trash2 } from "lucide-react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Badge, Button, cx, Empty, ErrorNote, Field, inputCls, LoadingPanel, Notice, postJson, SimTag, Table, Td, download, useFetch } from "./ui";
import { Drawer, Modal, Mono, CopyText, useMe } from "./scada";
import { useCart, usePrefs } from "@/lib/store";
import { priceCart, type PricedLine } from "@/lib/cart";
import { formatMoney, formatDateTime } from "@/lib/format";
import { LOCATIONS, LOGISTICS, type Product } from "@/lib/demoData";
import { can } from "@/lib/roleMatrix";

export function useProducts() {
  return useFetch<Product[]>("/api/market/products");
}

export function useMoney() {
  const currency = usePrefs((s) => s.currency);
  const rate = usePrefs((s) => s.rate);
  return (kobo: number) => formatMoney(kobo, currency, rate);
}

export function QtyStepper({ value, min, onChange, label }: { value: number; min: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="inline-flex items-center rounded-md border border-line" role="group" aria-label={label}>
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label={`Decrease ${label}`} className="p-2 hover:bg-elev disabled:opacity-40" disabled={value <= min}>
        <Minus className="h-4 w-4" />
      </button>
      <input aria-label={label} inputMode="numeric" value={value} onChange={(e) => onChange(Math.max(min, Number(e.target.value.replace(/\D/g, "")) || min))} className="w-14 bg-transparent text-center font-mono text-sm tabular" />
      <button onClick={() => onChange(value + 1)} aria-label={`Increase ${label}`} className="p-2 hover:bg-elev">
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

/** Small chart of the tag data behind a production lot. Simulated. */
export function ProvenancePanel({ p }: { p: Product }) {
  const data = useMemo(() => {
    const seed = p.id.length;
    return Array.from({ length: 24 }, (_, i) => ({ h: i, v: +(10 + Math.sin((i + seed) / 3) * 1.5 + ((i * 7 + seed) % 5) * 0.1).toFixed(2) }));
  }, [p.id]);
  return (
    <div className="rounded-md border border-line bg-elev p-4">
      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold uppercase tracking-wide text-muted">Lot provenance</span>
        <SimTag />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-muted">Lot</dt>
        <dd className="font-mono">{p.lot.lot_id}</dd>
        <dt className="text-muted">Site</dt>
        <dd>{p.lot.site}</dd>
        <dt className="text-muted">Period</dt>
        <dd>{p.lot.period}</dd>
        <dt className="text-muted">Source tag</dt>
        <dd className="font-mono">{p.lot.tag}</dd>
      </dl>
      <div className="mt-2 h-16" aria-label={`Hourly ${p.lot.tag} values behind lot ${p.lot.lot_id}`} role="img">
        <ResponsiveContainer>
          <LineChart data={data}>
            <XAxis dataKey="h" hide />
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Tooltip contentStyle={{ background: "var(--panel)", border: "1px solid var(--line)", fontSize: 11 }} />
            <Line dataKey="v" stroke="var(--fluid)" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function CoaModal({ p, onClose }: { p: Product | null; onClose: () => void }) {
  const [err, setErr] = useState("");
  const [hash, setHash] = useState<string | null>(null);
  return (
    <Modal open={!!p} onClose={() => (setHash(null), setErr(""), onClose())} title={p ? `Certificate of Analysis: ${p.lot.lot_id}` : ""} wide>
      {p && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <SimTag kind="Demo" />
            <span className="text-sm text-muted">{p.title}</span>
          </div>
          <Table head={["Component", "Gas chromatography result"]} caption="Gas chromatography breakdown">
            {(p.coa ?? []).map((r) => (
              <tr key={r.label}>
                <Td>{r.label}</Td>
                <Td mono>{r.value}</Td>
              </tr>
            ))}
          </Table>
          <Notice tone="neutral">Certifications are target standards, not claims. The PDF carries the platform document hash.</Notice>
          {err && <ErrorNote>{err}</ErrorNote>}
          {hash && (
            <Notice tone="ok">
              Downloaded. PDF SHA-256 <CopyText text={hash} />
            </Notice>
          )}
          <Button variant="slate" onClick={() => download(`/api/pdf/coa?product=${p.id}`, `COA-${p.lot.lot_id}.pdf`).then(setHash).catch((e) => setErr(e.message))}>
            <FileDown aria-hidden className="h-4 w-4" /> Download Official Signed COA (.PDF)
          </Button>
        </div>
      )}
    </Modal>
  );
}

type LedgerRow = { id: string; created_at: number; body: Record<string, unknown>; prev: string; hash: string };
export function LedgerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const r = useFetch<{ rows: LedgerRow[]; intact: boolean }>(open ? "/api/ledger" : null);
  return (
    <Modal open={open} onClose={onClose} title="Provenance Ledger: carbon offset tokens" wide>
      <div className="flex flex-col gap-4">
        <p className="text-sm text-muted">Append-only and hash-chained: each entry&apos;s SHA-256 covers the previous entry and the telemetry batch behind the credit. Issuance entries come from simulated scrubber data.</p>
        {r.loading && <LoadingPanel />}
        {r.error && <ErrorNote>{r.error}</ErrorNote>}
        {r.data && (
          <>
            <Badge tone={r.data.intact ? "ok" : "crit"}>{r.data.intact ? "Chain verified intact" : "Chain broken"}</Badge>
            <Table head={["Time", "Entry", "Batch / ref", "Hash", "Prev"]} caption="Provenance ledger entries">
              {r.data.rows.map((e) => (
                <tr key={e.id}>
                  <Td mono>{formatDateTime(e.created_at)}</Td>
                  <Td>
                    {String(e.body.type) === "issue" ? `Issue ${e.body.tokens} t (week ${e.body.week})` : `Retire ${e.body.tokens} t`} {e.body.simulated ? <SimTag /> : null}
                  </Td>
                  <Td>{e.body.telemetry_batch_sha256 ? <CopyText text={String(e.body.telemetry_batch_sha256)} /> : <Mono>{String(e.body.order_id ?? "")}</Mono>}</Td>
                  <Td>
                    <CopyText text={e.hash} />
                  </Td>
                  <Td>
                    <Mono className="text-xs text-muted">{e.prev.slice(0, 8)}</Mono>
                  </Td>
                </tr>
              ))}
            </Table>
          </>
        )}
      </div>
    </Modal>
  );
}

export function ProductCard({ p, onCoa, onLedger }: { p: Product; onCoa: (p: Product) => void; onLedger: () => void }) {
  const money = useMoney();
  const add = useCart((s) => s.add);
  const [pk, setPk] = useState(p.packaging[0].id);
  const pack = p.packaging.find((x) => x.id === pk)!;
  const [qty, setQty] = useState(Math.max(p.default_qty, pack.moq));
  const [err, setErr] = useState("");
  const secondary = {
    coa: { label: "View Certificate of Analysis (COA)", icon: FileText, run: () => onCoa(p) },
    "coa-solution": { label: "View Certificate of Analysis (COA)", icon: FileText, run: () => onCoa(p) },
    spec: { label: "Download Fuel Spec Sheet", icon: FileDown, run: () => download(`/api/pdf/spec?product=${p.id}`, `spec-${p.id}.pdf`).catch((e) => setErr(e.message)) },
    ledger: { label: "Inspect Provenance Ledger", icon: Link2, run: onLedger },
  }[p.secondary];
  return (
    <article className="flex flex-col overflow-hidden rounded-lg border border-line bg-panel" data-testid="product-card">
      <Link href={`/app/marketplace/p/${p.id}`} className="block bg-elev">
        <Image src={p.image} alt={p.alt} width={640} height={360} className="h-44 w-full object-cover" unoptimized />
      </Link>
      <div className="flex flex-1 flex-col gap-4 p-6">
        <div className="flex flex-wrap gap-1.5">
          <SimTag kind="Demo" />
          {p.badges.map((b) => (
            <Badge key={b} tone={b.startsWith("Target") ? "primary" : b.includes("Stock") || b.includes("Dispatch") ? "ok" : "fluid"}>
              {b}
            </Badge>
          ))}
        </div>
        <h3 className="text-base font-bold leading-snug">
          <Link href={`/app/marketplace/p/${p.id}`} className="hover:underline">
            {p.title}
          </Link>
        </h3>
        <p className="text-sm text-muted">{p.description}</p>
        <p className="text-xs text-muted">
          Captured at <span className="font-semibold text-fg">{p.lot.site}</span> on {p.lot.period}
        </p>
        {p.specs.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Specifications">
            {p.specs.map((s) => (
              <li key={s} className="rounded-full border border-line bg-elev px-2.5 py-0.5 font-mono text-[11px]">
                {s}
              </li>
            ))}
          </ul>
        )}
        {p.packaging.length > 1 ? (
          <Field id={`pk-${p.id}`} label="Packaging">
            <select
              id={`pk-${p.id}`}
              value={pk}
              onChange={(e) => {
                setPk(e.target.value);
                const m = p.packaging.find((x) => x.id === e.target.value)!.moq;
                setQty((q) => Math.max(q, m));
              }}
              className={inputCls}
            >
              {p.packaging.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}: {money(k.price_kobo)}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <div className="text-sm">
            <span className="font-mono text-lg font-bold">{money(pack.price_kobo)}</span> <span className="text-muted">per {pack.label.replace(/^Per /i, "").toLowerCase()}</span>
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <QtyStepper value={qty} min={pack.moq} onChange={setQty} label={`Quantity for ${p.title}`} />
          <span className="text-xs text-muted">MOQ {pack.moq}</span>
        </div>
        <ProvenancePanel p={p} />
        {err && <ErrorNote>{err}</ErrorNote>}
        <div className="mt-auto flex flex-col gap-2">
          <Button variant="shop" onClick={() => add({ productId: p.id, packagingId: pk, qty })}>
            <ShoppingCart aria-hidden className="h-4 w-4" /> {p.secondary === "ledger" ? "Buy & Retire Tokens" : "Add to Cart / Request RFQ"}
          </Button>
          <Button variant="slate" onClick={secondary.run}>
            <secondary.icon aria-hidden className="h-4 w-4" /> {secondary.label}
          </Button>
        </div>
      </div>
    </article>
  );
}

/** Cart and RFQ drawer. Totals here are a preview; the server recomputes every price from the database. */
export function CartDrawer() {
  const cart = useCart();
  const money = useMoney();
  const { me } = useMe();
  const products = useFetch<Product[]>(cart.open ? "/api/market/products" : null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "ok" | "crit"; text: string } | null>(null);
  const priced = useMemo(() => priceCart(cart.lines, products.data ?? [], cart.logistics), [cart.lines, products.data, cart.logistics]);
  const body = { lines: cart.lines, logistics: cart.logistics, location: cart.location };
  const signedIn = !!me?.session;
  const canBuy = can(me?.session?.role, "buy");
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg({ tone: "crit", text: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  return (
    <Drawer open={cart.open} onClose={() => cart.setOpen(false)} title="Cart and RFQ">
      <div className="flex flex-col gap-6">
        {!cart.lines.length && <Empty title="Your cart is empty">Add products from the marketplace.</Empty>}
        {cart.lines.length > 0 && products.loading && <LoadingPanel />}
        {cart.lines.length > 0 && products.data && (
          <>
            <ul className="flex flex-col gap-4" aria-label="Itemised manifest">
              {cart.lines.map((l, i) => {
                const pl = priceCart([l], products.data!, "pickup").lines[0];
                const p = products.data!.find((x) => x.id === l.productId);
                const pk = p?.packaging.find((k) => k.id === l.packagingId);
                return (
                  <li key={i} className="rounded-md border border-line p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold">{p?.title ?? l.productId}</div>
                        <div className="text-xs text-muted">{pk?.label}</div>
                      </div>
                      <button onClick={() => cart.remove(i)} aria-label={`Remove ${p?.title}`} className="rounded p-1 text-muted hover:bg-elev hover:text-crit-fg">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <QtyStepper value={l.qty} min={pk?.moq ?? 1} onChange={(v) => cart.setQty(i, v)} label={`Quantity for ${p?.title}`} />
                      <div className="text-right font-mono text-sm tabular">
                        <div className="text-xs text-muted">{pk ? money(pk.price_kobo) : ""} each</div>
                        <div className="font-semibold">{pl ? money(pl.subtotal_kobo) : "-"}</div>
                        {pl?.rebate_kobo ? <div className="text-xs text-ok-fg">12% volume rebate</div> : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm font-semibold">Logistics</legend>
              {LOGISTICS.map((o, i) => (
                <label key={o.id} className="flex items-start gap-2 rounded-md border border-line p-3 text-sm">
                  <input type="radio" name="logistics" checked={cart.logistics === o.id} onChange={() => cart.setLogistics(o.id)} className="mt-1" />
                  <span>
                    Option {i ? "B" : "A"}: {o.label} <span className="font-mono text-muted">{o.kobo ? `+${money(o.kobo)}` : "Free"}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <Field id="cart-loc" label="Delivery location">
              <select id="cart-loc" value={cart.location} onChange={(e) => cart.setLocation(e.target.value)} className={inputCls}>
                {LOCATIONS.map((l) => (
                  <option key={l}>{l}</option>
                ))}
              </select>
            </Field>
            <dl className="grid grid-cols-2 gap-y-2 rounded-md border border-line bg-elev p-4 font-mono text-sm tabular">
              <dt className="font-sans text-muted">Subtotal</dt>
              <dd className="text-right">{money(priced.subtotal)}</dd>
              <dt className="font-sans text-muted">Logistics</dt>
              <dd className="text-right">{money(priced.logistics)}</dd>
              <dt className="font-sans text-muted">VAT 7.5%</dt>
              <dd className="text-right">{money(priced.vat)}</dd>
              <dt className="font-sans text-muted">ESG tax exemption credits</dt>
              <dd className="text-right">-{money(priced.esgCredit)}</dd>
              <dt className="border-t border-line pt-2 font-sans font-bold">Total due</dt>
              <dd className="border-t border-line pt-2 text-right text-base font-bold" data-testid="cart-total">
                {money(priced.total)}
              </dd>
            </dl>
            {priced.errors.length > 0 && <ErrorNote>{priced.errors.join("; ")}</ErrorNote>}
            <Notice tone="neutral">
              <ShieldCheck aria-hidden className="mr-1 inline h-4 w-4" />
              <strong>Planned settlement model:</strong> Payment is held securely in an audited Nigerian banking escrow account. Funds are released to the refinery only after physical weightbridge inspection and gas purity verification at your receiving dock. The demo uses Paystack test mode.
            </Notice>
            {msg && (msg.tone === "ok" ? <Notice tone="ok">{msg.text}</Notice> : <ErrorNote>{msg.text}</ErrorNote>)}
            {!signedIn && (
              <Notice tone="warn">
                <Link href="/sign-in" className="underline">
                  Sign in
                </Link>{" "}
                to generate invoices, submit RFQs or pay.
              </Notice>
            )}
            <div className="flex flex-col gap-2">
              <Button
                variant="slate"
                disabled={!signedIn || priced.errors.length > 0}
                busy={busy === "pf"}
                onClick={() =>
                  run("pf", async () => {
                    const h = await download("/api/pdf/proforma", "proforma-invoice.pdf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                    setMsg({ tone: "ok", text: `Proforma invoice generated. PDF SHA-256 ${h?.slice(0, 16)}…` });
                  })
                }
              >
                <FileDown aria-hidden className="h-4 w-4" /> Generate Proforma Invoice (PDF)
              </Button>
              <Button
                variant="shop"
                disabled={!canBuy || priced.errors.length > 0}
                busy={busy === "rfq"}
                onClick={() =>
                  run("rfq", async () => {
                    const r = await postJson<{ rfq_id: string; escrow_slot: string }>("/api/market/rfq", body);
                    setMsg({ tone: "ok", text: `RFQ ${r.rfq_id} submitted. Escrow slot ${r.escrow_slot} locked (planned model).` });
                  })
                }
              >
                <Lock aria-hidden className="h-4 w-4" /> Submit RFQ &amp; Lock Escrow Slot
              </Button>
              <Button
                variant="primary"
                disabled={!canBuy || priced.errors.length > 0}
                busy={busy === "pay"}
                onClick={() =>
                  run("pay", async () => {
                    const r = await postJson<{ authorization_url: string }>("/api/market/checkout", body);
                    location.href = r.authorization_url;
                  })
                }
              >
                <CreditCard aria-hidden className="h-4 w-4" /> Pay with Paystack (test mode)
              </Button>
              {signedIn && !canBuy && <p className="text-xs text-muted">Your role cannot buy. Buyer, seller or admin roles can.</p>}
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}

export type Order = { id: string; created_at: number; status: string; total_kobo: number; items: PricedLine[]; location: string; buyer_email: string; seller_id: string; paid_at?: number };
const STEPS = ["pending_payment", "paid", "processing", "shipped", "delivered"];
const LABEL: Record<string, string> = { pending_payment: "Pending payment", paid: "Paid", processing: "Processing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled" };

export function OrderTrack({ status }: { status: string }) {
  if (status === "cancelled") return <Badge tone="crit">Cancelled</Badge>;
  const at = STEPS.indexOf(status);
  return (
    <ol className="flex flex-wrap items-center gap-2 text-xs" aria-label={`Order status: ${LABEL[status]}`}>
      {STEPS.map((s, i) => (
        <li key={s} className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-1", i <= at ? "border-ok/50 bg-ok-bg text-ok-fg" : "border-line text-muted")} aria-current={i === at ? "step" : undefined}>
          {i <= at && <Check aria-hidden className="h-3 w-3" />}
          {LABEL[s]}
        </li>
      ))}
    </ol>
  );
}

