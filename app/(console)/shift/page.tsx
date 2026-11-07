"use client";
import { useState } from "react";
import { Handshake, NotebookPen } from "lucide-react";
import { Badge, Button, Card, Empty, ErrorNote, Field, inputCls, LoadingPanel, Notice, Page, SimTag, postJson, useFetch } from "@/components/ui";
import { useMe } from "@/components/scada";
import { can } from "@/lib/roleMatrix";
import { formatDateTime } from "@/lib/format";

type Entry = { id: string; created_at: number; shift: string; author: string; author_id?: string; note: string; handover: boolean; accepted_by?: string; demo?: boolean };

export default function Shift() {
  const { me } = useMe();
  const [n, setN] = useState(0);
  const r = useFetch<Entry[]>("/api/shift", [n]);
  const [f, setF] = useState({ shift: "Shift Alpha", note: "", handover: false });
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const canWrite = can(me?.session?.role, "ack");
  const run = async (k: string, fn: () => Promise<unknown>, ok: string) => {
    setBusy(k);
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
    <Page title="Shift log and handover" subtitle="Handover is signed off by the incoming shift: the author cannot accept their own handover.">
      <Card title="New entry">
        <form
          className="grid grid-cols-1 gap-6 md:grid-cols-[200px_1fr]"
          onSubmit={(e) => {
            e.preventDefault();
            run("add", () => postJson("/api/shift", f), f.handover ? "Handover posted. The incoming shift must sign it off." : "Note added.");
            setF({ ...f, note: "" });
          }}
        >
          <Field id="sh-shift" label="Shift">
            <select id="sh-shift" value={f.shift} onChange={(e) => setF({ ...f, shift: e.target.value })} className={inputCls}>
              {["Shift Alpha", "Shift Bravo", "Shift Charlie"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field id="sh-note" label="Log entry">
            <textarea id="sh-note" required rows={3} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} className={inputCls} />
          </Field>
          <label className="flex items-center gap-2 text-sm md:col-start-2">
            <input type="checkbox" checked={f.handover} onChange={(e) => setF({ ...f, handover: e.target.checked })} className="h-4 w-4" /> This is a shift handover
          </label>
          <div className="md:col-start-2">
            <Button variant="primary" type="submit" disabled={!canWrite} busy={busy === "add"}>
              <NotebookPen aria-hidden className="h-4 w-4" /> Add entry
            </Button>
          </div>
        </form>
        {!canWrite && me?.session && <p className="mt-3 text-sm text-muted">Operators and above can write the shift log.</p>}
      </Card>
      {msg && (msg.ok ? <Notice tone="ok">{msg.t}</Notice> : <ErrorNote>{msg.t}</ErrorNote>)}
      <Card title="Log">
        {r.loading && <LoadingPanel />}
        {r.error && <ErrorNote>{r.error}</ErrorNote>}
        {r.data && !r.data.length && <Empty title="No shift entries yet" />}
        <ol className="flex flex-col divide-y divide-line">
          {r.data?.map((e) => (
            <li key={e.id} className="flex flex-col gap-2 py-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-mono text-muted">{formatDateTime(e.created_at)}</span>
                <span className="font-semibold">{e.shift}</span>
                <span className="text-muted">by {e.author}</span>
                {e.handover && (e.accepted_by ? <Badge tone="ok">Handover accepted by {e.accepted_by}</Badge> : <Badge tone="warn">Handover awaiting sign-off</Badge>)}
                {e.demo && <SimTag kind="Demo" />}
              </div>
              <p className="text-sm">{e.note}</p>
              {e.handover && !e.accepted_by && canWrite && (
                <div>
                  <Button busy={busy === e.id} onClick={() => run(e.id, () => postJson("/api/shift", { id: e.id }, "PATCH"), "Handover signed off.")}>
                    <Handshake aria-hidden className="h-4 w-4" /> Sign off handover
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ol>
      </Card>
    </Page>
  );
}
