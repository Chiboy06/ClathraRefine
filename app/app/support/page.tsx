"use client";
import { useState } from "react";
import { FileDown, Phone, Send } from "lucide-react";
import { Badge, Button, Card, Empty, ErrorNote, Field, inputCls, LoadingPanel, Notice, Page, SimTag, download, postJson, useFetch } from "@/components/ui";
import { useBoard } from "@/components/plant";
import { formatDateTime } from "@/lib/format";

type Ticket = { id: string; created_at: number; category: string; severity: string; description: string; status: string; by: string; snapshot_csv?: string; demo?: boolean };
const LIB = [
  { doc: "wiring", label: "ESP32-S3 Wiring Schematics" },
  { doc: "sds", label: "Solvent SDS Sheets" },
  { doc: "ndir", label: "NDIR Calibration Curves" },
  { doc: "rbac", label: "Clerk RBAC Matrix" },
];

export default function Support() {
  const { p } = useBoard();
  const [n, setN] = useState(0);
  const tickets = useFetch<Ticket[]>("/api/tickets", [n]);
  const [f, setF] = useState({ category: "Sensor", severity: "Medium", description: "" });
  const [snap, setSnap] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const csv = () => {
    const since = (p.now || Date.now()) - 15 * 60_000;
    const rows = p.history.filter((h) => h.receivedAt >= since);
    return ["received_utc,exhaust_mv,ambient_mv,ambient_level,scrubber,relay_mask,trip_latched,scram,sensor_fault,warming_up", ...rows.map((h) => [new Date(h.receivedAt).toISOString(), h.exhaust_mv, h.ambient_mv, h.ambient_level, h.scrubber, h.relay_mask, h.trip_latched, h.scram, h.sensor_fault, h.warming_up].join(","))].join("\n");
  };
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await postJson("/api/tickets", { ...f, ...(snap && { snapshot_csv: csv() }) });
      setMsg({ ok: true, t: "Priority ticket submitted." });
      setF({ ...f, description: "" });
      setN((x) => x + 1);
    } catch (x) {
      setMsg({ ok: false, t: (x as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page title="24/7 field support and chemical emergency desk">
      <div role="alert" className="flex flex-col gap-2 rounded-lg border border-crit bg-crit px-6 py-4 text-white md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 font-semibold">
          <Phone aria-hidden className="h-5 w-5" /> 24/7 hotline: <span className="font-mono">+234 800 CLATHRA</span>
          <span className="rounded bg-white px-1.5 text-[10px] font-semibold uppercase text-red-700">Demo number</span>
        </div>
        <div className="text-sm">Rapid dispatch SLA: &lt; 8 seconds to acknowledge (target)</div>
      </div>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-8">
          <Card title="Submit a ticket">
            <form onSubmit={submit} className="flex flex-col gap-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field id="tk-cat" label="Category">
                  <select id="tk-cat" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} className={inputCls}>
                    {["Sensor", "Relay", "Network", "Solvent / chemical", "Marketplace", "Other"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
                <Field id="tk-sev" label="Severity">
                  <select id="tk-sev" value={f.severity} onChange={(e) => setF({ ...f, severity: e.target.value })} className={inputCls}>
                    {["Low", "Medium", "High", "Critical"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </Field>
              </div>
              <Field id="tk-desc" label="Problem description">
                <textarea id="tk-desc" required rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} className={inputCls} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" role="switch" aria-checked={snap} checked={snap} onChange={(e) => setSnap(e.target.checked)} className="h-4 w-4" />
                Attach 15-Min Sensor Snapshot (CSV, {p.history.filter((h) => h.receivedAt >= (p.now || 0) - 900_000).length} readings)
              </label>
              {msg && (msg.ok ? <Notice tone="ok">{msg.t}</Notice> : <ErrorNote>{msg.t}</ErrorNote>)}
              <Button variant="danger" type="submit" busy={busy}>
                <Send aria-hidden className="h-4 w-4" /> Submit Priority Ticket
              </Button>
            </form>
          </Card>
          <Card title="Tickets">
            {tickets.loading && <LoadingPanel />}
            {tickets.error && <ErrorNote>{tickets.error}</ErrorNote>}
            {tickets.data && !tickets.data.length && <Empty title="No tickets yet" />}
            <ul className="flex flex-col divide-y divide-line">
              {tickets.data?.map((t) => (
                <li key={t.id} className="flex flex-col gap-1 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={t.severity === "Critical" ? "crit" : t.severity === "High" ? "warn" : "neutral"}>{t.severity}</Badge>
                    <span className="font-semibold">{t.category}</span>
                    <Badge tone={t.status === "Resolved" ? "ok" : "primary"}>{t.status}</Badge>
                    {t.snapshot_csv && <Badge tone="fluid">CSV attached</Badge>}
                    {t.demo && <SimTag kind="Demo" />}
                  </div>
                  <p>{t.description}</p>
                  <span className="text-xs text-muted">
                    {formatDateTime(t.created_at)} · {t.by}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <Card title="Technical library">
          <ul className="flex flex-col gap-3">
            {LIB.map((d) => (
              <li key={d.doc}>
                <Button className="w-full justify-between" onClick={() => download(`/api/pdf/library?doc=${d.doc}`, `${d.doc}.pdf`).catch((e) => setMsg({ ok: false, t: e.message }))}>
                  {d.label} <FileDown aria-hidden className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-muted">Generated as PDFs from the build guide. The NDIR sheet is a template: no NDIR sensor is fitted to the current hardware.</p>
        </Card>
      </div>
    </Page>
  );
}
