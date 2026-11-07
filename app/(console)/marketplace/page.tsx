"use client";
import { useMemo, useState } from "react";
import { MapPin, Search, ShoppingCart } from "lucide-react";
import { Empty, ErrorNote, Page, Skeleton, SimTag, cx, inputCls, useMounted } from "@/components/ui";
import { CoaModal, LedgerModal, ProductCard, useProducts } from "@/components/market";
import { CATEGORIES, LOCATIONS, type Product } from "@/lib/demoData";
import { useCart } from "@/lib/store";

export default function Marketplace() {
  const r = useProducts();
  const cart = useCart();
  const mounted = useMounted();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All Fractions");
  const [coa, setCoa] = useState<Product | null>(null);
  const [ledger, setLedger] = useState(false);
  const shown = useMemo(
    () =>
      (r.data ?? [])
        .filter((p) => p.status === "live")
        .filter((p) => cat === "All Fractions" || p.category === cat)
        .filter((p) => !q || `${p.title} ${p.description} ${p.specs.join(" ")} ${p.packaging.map((k) => k.label).join(" ")} ${p.badges.join(" ")}`.toLowerCase().includes(q.toLowerCase())),
    [r.data, q, cat],
  );
  return (
    <Page title="B2B gas marketplace" subtitle={<>Recovered materials with proof of origin. Every listing is a Demo listing <SimTag kind="Demo" /></>}>
      <div className="flex flex-col gap-4 rounded-lg border border-line bg-panel p-6">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <label htmlFor="mk-search" className="sr-only">
              Search the marketplace
            </label>
            <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input id="mk-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by gas fraction, purity grade, cylinder skid, or ISO tanker..." className={inputCls + " pl-9"} />
          </div>
          <div className="relative md:w-72">
            <label htmlFor="mk-loc" className="sr-only">
              Delivery location
            </label>
            <MapPin aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <select id="mk-loc" value={mounted ? cart.location : LOCATIONS[1]} onChange={(e) => cart.setLocation(e.target.value)} className={inputCls + " pl-9"}>
              {LOCATIONS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </div>
        </div>
        <div role="group" aria-label="Categories" className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={cx("rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors duration-150", cat === c ? "border-shop bg-shop-bg text-shop-fg" : "border-line text-muted hover:text-fg")}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {r.error && <ErrorNote>{r.error}</ErrorNote>}
      {r.loading && !r.data ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[560px]" />
          ))}
        </div>
      ) : shown.length ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <ProductCard key={p.id} p={p} onCoa={setCoa} onLedger={() => setLedger(true)} />
          ))}
        </div>
      ) : (
        <Empty title="No listings in this category yet">Try All Fractions, or check back when a seller lists a lot.</Empty>
      )}

      <button onClick={() => cart.setOpen(true)} className="fixed bottom-6 right-6 z-20 inline-flex items-center gap-2 rounded-full bg-shop px-5 py-3 font-semibold text-slate-950 shadow-lg hover:bg-shop/90">
        <ShoppingCart aria-hidden className="h-5 w-5" /> Cart
        <span className="rounded-full bg-slate-950 px-2 text-xs text-white" data-testid="cart-count">
          {mounted ? cart.lines.length : 0}
        </span>
      </button>
      <CoaModal p={coa} onClose={() => setCoa(null)} />
      <LedgerModal open={ledger} onClose={() => setLedger(false)} />
    </Page>
  );
}
