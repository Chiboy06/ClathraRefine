"use client";
import { useState } from "react";
import { FileArchive, FileDown } from "lucide-react";
import { Badge, Button, Card, Empty, ErrorNote, Field, inputCls, LoadingPanel, Page, SimTag, Table, Td, download, useFetch } from "@/components/ui";
import { CopyText, Mono } from "@/components/scada";
import { formatDateTime } from "@/lib/format";

type A = { id: string; standard: string; auditor: string; unit: string; score: number; status: string; created_at: number; sha256: string | null; demo?: boolean };

export default function AuditHistory() {
  const r = useFetch<A[]>("/api/audits");
  const [q, setQ] = useState("");
  const [std, setStd] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fromMs = from ? Date.parse(from) : 0;
  const toMs = to ? Date.parse(to) + 86_400_000 - 1 : Number.MAX_SAFE_INTEGER;
  const rows = (r.data ?? []).filter((a) => (!std || a.standard === std) && a.created_at >= fromMs && a.created_at <= toMs && (!q || `${a.id} ${a.auditor} ${a.unit}`.toLowerCase().includes(q.toLowerCase())));
  const zip = async () => {
    setBusy(true);
    setErr("");
    try {
      const params = new URLSearchParams({ ...(std && { standard: std }), from: String(fromMs), to: String(toMs) });
      await download(`/api/compliance-zip?${params}`, "compliance-batch.zip");
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page title="Audit history and statutory archive" subtitle="OSHA 1910 exports are templates (US law). Nigerian references: NUPRC, NMDPRA, NESREA.">
      <Card>
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 lg:grid-cols-5">
          <Field id="ah-q" label="Search">
            <input id="ah-q" value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} placeholder="ID, auditor or unit" />
          </Field>
          <Field id="ah-std" label="Standard">
            <select id="ah-std" value={std} onChange={(e) => setStd(e.target.value)} className={inputCls}>
              <option value="">All standards</option>
              <option>ISO 14064</option>
              <option>OSHA 1910</option>
              <option>NESREA</option>
            </select>
          </Field>
          <Field id="ah-from" label="From">
            <input id="ah-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </Field>
          <Field id="ah-to" label="To">
            <input id="ah-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </Field>
          <Button variant="primary" busy={busy} onClick={zip}>
            <FileArchive aria-hidden className="h-4 w-4" /> Download Batch Compliance ZIP
          </Button>
        </div>
        {err && <div className="mt-4"><ErrorNote>{err}</ErrorNote></div>}
      </Card>
      <Card>
        {r.loading && <LoadingPanel rows={6} />}
        {r.error && <ErrorNote>{r.error}</ErrorNote>}
        {r.data && !rows.length && <Empty title="No audits match the filters" />}
        {!!rows.length && (
          <Table head={["Audit ID", "Timestamp", "Auditor", "Unit", "Score", "Status", "SHA-256", "PDF"]} caption="Audit archive">
            {rows.map((a) => (
              <tr key={a.id}>
                <Td mono>
                  {a.id} {a.demo && <SimTag kind="Demo" />}
                </Td>
                <Td mono>{formatDateTime(a.created_at)}</Td>
                <Td>{a.auditor}</Td>
                <Td>{a.unit}</Td>
                <Td mono>{a.score}%</Td>
                <Td>
                  <Badge tone={a.status === "Published" ? "ok" : a.status === "Corrective action" ? "warn" : "primary"}>{a.status}</Badge>
                </Td>
                <Td>{a.sha256 ? <CopyText text={a.sha256} /> : <Mono className="text-xs text-muted">not published</Mono>}</Td>
                <Td>
                  <Button onClick={() => download(`/api/pdf/audit?id=${a.id}`, `${a.id}.pdf`).catch((e) => setErr(e.message))} aria-label={`Download ${a.id} PDF`}>
                    <FileDown aria-hidden className="h-4 w-4" /> PDF
                  </Button>
                </Td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
    </Page>
  );
}
