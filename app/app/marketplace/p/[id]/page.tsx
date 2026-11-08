"use client";
import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, ErrorNote, LoadingPanel, Page, SimTag, Table, Td, useFetch } from "@/components/ui";
import { CoaModal, LedgerModal, ProductCard, useMoney } from "@/components/market";
import type { Product } from "@/lib/demoData";

export default function ProductDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const r = useFetch<Product>(`/api/market/products/${encodeURIComponent(id)}`);
  const money = useMoney();
  const [coa, setCoa] = useState<Product | null>(null);
  const [ledger, setLedger] = useState(false);
  const p = r.data;
  return (
    <Page
      title={p?.title ?? "Product"}
      subtitle={
        <Link href="/app/marketplace" className="inline-flex items-center gap-1 hover:underline">
          <ArrowLeft aria-hidden className="h-4 w-4" /> Back to marketplace
        </Link>
      }
    >
      {r.loading && <LoadingPanel rows={6} />}
      {r.error && <ErrorNote>{r.error === "Not found" ? "This listing does not exist or is not live." : r.error}</ErrorNote>}
      {p && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,420px)_1fr]">
          <ProductCard p={p} onCoa={setCoa} onLedger={() => setLedger(true)} />
          <div className="flex flex-col gap-6">
            <Card title="Seller and lot" actions={<SimTag kind="Demo" />}>
              <dl className="grid grid-cols-2 gap-y-2 text-sm">
                <dt className="text-muted">Seller</dt>
                <dd>{p.seller_name}</dd>
                <dt className="text-muted">Category</dt>
                <dd>{p.category}</dd>
                <dt className="text-muted">Stock</dt>
                <dd>{p.stock_label}</dd>
                <dt className="text-muted">Lot</dt>
                <dd className="font-mono">{p.lot.lot_id}</dd>
                <dt className="text-muted">Production period</dt>
                <dd>{p.lot.period}</dd>
              </dl>
            </Card>
            <Card title="Packaging and prices">
              <Table head={["Option", "Unit price", "Minimum order"]} caption="Packaging options">
                {p.packaging.map((k) => (
                  <tr key={k.id}>
                    <Td>{k.label}</Td>
                    <Td mono>{money(k.price_kobo)}</Td>
                    <Td mono>{k.moq}</Td>
                  </tr>
                ))}
              </Table>
            </Card>
            {p.coa && (
              <Card title="Analysis (Demo)">
                <Table head={["Component", "Result"]} caption="Analysis">
                  {p.coa.map((c) => (
                    <tr key={c.label}>
                      <Td>{c.label}</Td>
                      <Td mono>{c.value}</Td>
                    </tr>
                  ))}
                </Table>
              </Card>
            )}
          </div>
        </div>
      )}
      <CoaModal p={coa} onClose={() => setCoa(null)} />
      <LedgerModal open={ledger} onClose={() => setLedger(false)} />
    </Page>
  );
}
