"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDownUp, Store } from "lucide-react";
import { Badge, Button, Card, ErrorNote, Notice, Page, SimTag, Table, Td, postJson, cx } from "@/components/ui";
import { Drawer, Mono } from "@/components/scada";
import { DEPARTMENTS, QUOTA } from "@/lib/demoData";
import { num } from "@/lib/format";

type Dept = (typeof DEPARTMENTS)[number];
type Key = "name" | "flowM3h" | "emissionKgH" | "pct" | "status";
const statusTone = (s: string) => (s === "Optimal" ? "ok" : s === "Running" ? "fluid" : "warn") as "ok" | "fluid" | "warn";

export default function Departments() {
  const [sort, setSort] = useState<{ k: Key; dir: 1 | -1 }>({ k: "emissionKgH", dir: -1 });
  const [sel, setSel] = useState<Dept | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const rows = useMemo(
    () =>
      DEPARTMENTS.map((d) => ({ ...d, pct: (d.usedMt / d.quotaMt) * 100 })).sort((a, b) => {
        const x = a[sort.k], y = b[sort.k];
        return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
      }),
    [sort],
  );
  const th = (k: Key, label: string) => (
    <button onClick={() => setSort((s) => ({ k, dir: s.k === k ? (-s.dir as 1 | -1) : -1 }))} className="inline-flex items-center gap-1 uppercase" aria-label={`Sort by ${label}`}>
      {label} <ArrowDownUp aria-hidden className={cx("h-3 w-3", sort.k === k ? "text-fg" : "opacity-40")} />
    </button>
  );

  const listSurplus = async () => {
    setBusy(true);
    setErr("");
    try {
      const r = await postJson<{ id: string }>("/api/market/products", {
        title: `Carbon offset tokens, surplus quota ${new Date().toISOString().slice(0, 7)}`,
        category: "Carbon Offsets (VCS)",
        description: `Surplus of ${QUOTA.surplusMt} MT CO2e against the monthly ${num(QUOTA.monthlyMt)} MT quota. Draft listing for seller review.`,
        packaging_label: "Metric-ton token",
        price_kobo: 3_550_000,
        moq: 1,
        stock: QUOTA.surplusMt,
        lot_id: `LOT-QUOTA-${new Date().toISOString().slice(0, 7)}`,
      });
      setDraft(r.id);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="Departmental allocation and consumption" subtitle={<>Demo departments <SimTag kind="Demo" /></>}>
      <Card title="Monthly carbon quota" actions={<SimTag kind="Demo" />}>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div>
            <div className="text-sm text-muted">Quota</div>
            <Mono className="text-2xl font-bold">{num(QUOTA.monthlyMt)} MT CO2e</Mono>
          </div>
          <div>
            <div className="text-sm text-muted">Consumed</div>
            <Mono className="text-2xl font-bold">{QUOTA.consumedPct}%</Mono>
            <div className="mt-2 h-2 rounded bg-elev" role="progressbar" aria-valuenow={QUOTA.consumedPct} aria-valuemin={0} aria-valuemax={100} aria-label="Quota consumed">
              <div className="h-2 rounded bg-fluid" style={{ width: `${QUOTA.consumedPct}%` }} />
            </div>
          </div>
          <div>
            <div className="text-sm text-muted">Surplus available for commercial sale</div>
            <Mono className="text-2xl font-bold text-ok-fg">{num(QUOTA.surplusMt)} MT</Mono>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="shop" busy={busy} onClick={listSurplus}>
            <Store aria-hidden className="h-4 w-4" /> List surplus on marketplace
          </Button>
          {draft && (
            <Notice tone="ok">
              Draft listing created. Review it in the <Link href="/marketplace/seller" className="underline">seller centre</Link>.
            </Notice>
          )}
          {err && <ErrorNote>{err}</ErrorNote>}
        </div>
      </Card>

      <Card title="Departments">
        <Table head={[th("name", "Department"), "Active Gas", th("flowM3h", "Flow Rate"), th("emissionKgH", "Emission Rate (kg/h)"), th("pct", "Quota"), th("status", "Operational Status")]} caption="Departments, sortable">
          {rows.map((d) => (
            <tr key={d.id} className="cursor-pointer hover:bg-elev" onClick={() => setSel(d)}>
              <Td>
                <button className="text-left font-semibold hover:underline" onClick={() => setSel(d)}>
                  {d.name}
                </button>
              </Td>
              <Td>{d.gas}</Td>
              <Td mono>{num(d.flowM3h)} m³/h</Td>
              <Td mono>{num(d.emissionKgH, 1)}</Td>
              <Td>
                <div className="flex min-w-32 items-center gap-2">
                  <div className="h-2 flex-1 rounded bg-elev" role="progressbar" aria-valuenow={Math.round(d.pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${d.name} quota used`}>
                    <div className={cx("h-2 rounded", d.pct > 75 ? "bg-warn" : "bg-ok")} style={{ width: `${d.pct}%` }} />
                  </div>
                  <Mono className="text-xs">{d.pct.toFixed(0)}%</Mono>
                </div>
              </Td>
              <Td>
                <Badge tone={statusTone(d.status)}>{d.status}</Badge>
              </Td>
            </tr>
          ))}
        </Table>
      </Card>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel?.name ?? ""}>
        {sel && (
          <dl className="grid grid-cols-2 gap-y-3 text-sm">
            <dt className="text-muted">Active gas</dt>
            <dd>{sel.gas}</dd>
            <dt className="text-muted">Flow rate</dt>
            <dd className="font-mono">{num(sel.flowM3h)} m³/h</dd>
            <dt className="text-muted">Emission rate</dt>
            <dd className="font-mono">{num(sel.emissionKgH, 1)} kg/h</dd>
            <dt className="text-muted">Quota used</dt>
            <dd className="font-mono">
              {sel.usedMt} of {sel.quotaMt} MT
            </dd>
            <dt className="text-muted">Monthly projection</dt>
            <dd className="font-mono">{num((sel.emissionKgH * 24 * 30) / 1000, 0)} MT</dd>
            <dt className="text-muted">Status</dt>
            <dd>
              <Badge tone={statusTone(sel.status)}>{sel.status}</Badge>
            </dd>
            <dt className="text-muted">Data</dt>
            <dd>
              <SimTag kind="Demo" />
            </dd>
          </dl>
        )}
      </Drawer>
    </Page>
  );
}
