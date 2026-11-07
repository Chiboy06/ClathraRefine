"use client";
import { useState } from "react";
import { FileDown, Lock, Play, Save, Upload } from "lucide-react";
import { Badge, Button, Card, ErrorNote, Field, inputCls, Notice, Page, SimTag, Table, Td, download, postJson, useFetch } from "@/components/ui";
import { CopyText, Mono, useMe } from "@/components/scada";
import { useBoard } from "@/components/plant";
import { usePrefs } from "@/lib/store";
import { can } from "@/lib/roleMatrix";
import { FW } from "@/lib/process";
import type { AuditRecord } from "@/lib/docs";

const AUDIT_ID = "AUD-2026-0891";
type Check = { name: string; value: string; pass: boolean };

const DEMO_CHECKS: Check[] = [
  { name: "Exhaust Sensor Baseline", value: "+0.03 V", pass: true },
  { name: "Ambient Response Time", value: "142 ms", pass: true },
  { name: "Scrubber Pump 2.0 s Delay", value: "2.01 s synchronised", pass: true },
  { name: "Scram Loop", value: "18 ms", pass: true },
];

export default function Audits() {
  const { me } = useMe();
  const { p, l } = useBoard();
  const mode = usePrefs((s) => s.mode);
  const existing = useFetch<(AuditRecord & { locked: boolean; sha256: string | null })[]>("/api/audits");
  const cur = existing.data?.find((a) => a.id === AUDIT_ID);
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [running, setRunning] = useState(false);
  const [ph, setPh] = useState(12.4);
  const [flange, setFlange] = useState<"Pass" | "Minor leak" | "Fail">("Pass");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<{ key: string; name: string }[]>([]);
  const [signature, setSignature] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  const canAudit = can(me?.session?.role, "audit");
  const locked = !!cur?.locked || !!hash;

  const runDiagnostic = async () => {
    setRunning(true);
    setChecks(null);
    try {
      if (mode === "DEMO") {
        await new Promise((r) => setTimeout(r, 600));
        setChecks(DEMO_CHECKS);
        return;
      }
      const out: Check[] = [];
      const t0 = Date.now();
      try {
        const r = await postJson<{ sent_at: number }>("/api/ping", { mode: "LIVE" });
        let rtt: number | null = null;
        for (let i = 0; i < 20 && rtt === null; i++) {
          await new Promise((res) => setTimeout(res, 500));
          const ev = (await (await fetch("/api/events?limit=10", { cache: "no-store" })).json()) as { cmd?: string; ingest_ms: number }[];
          const ack = ev.find((e) => e.cmd === "ping" && e.ingest_ms >= r.sent_at);
          if (ack) rtt = ack.ingest_ms - r.sent_at;
        }
        out.push({ name: "Ping round trip", value: rtt === null ? "no ack in 10 s" : `${rtt} ms`, pass: rtt !== null && rtt < 3000 });
      } catch (e) {
        out.push({ name: "Ping round trip", value: (e as Error).message, pass: false });
      }
      out.push({ name: "Last warm-up completed", value: l ? (l.warming_up ? "still warming up" : "complete") : "no data", pass: !!l && !l.warming_up });
      out.push({ name: "Sensor fault clear", value: l ? (l.sensor_fault ? "fault" : "clear") : "no data", pass: !!l && !l.sensor_fault });
      out.push({ name: "Ambient baseline within limits", value: l ? `${l.ambient_mv} mV (100 to ${FW.AMB_WARN_OFF_MV})` : "no data", pass: !!l && l.ambient_mv >= 100 && l.ambient_mv <= FW.AMB_WARN_OFF_MV });
      const h = p.history;
      let stagger: number | null = null;
      for (let i = h.length - 1; i > 0 && stagger === null; i--) {
        if (h[i].scrubber === "SCRUBBING" && h[i - 1].scrubber === "INTAKE_ACTIVE") {
          let j = i - 1;
          while (j > 0 && h[j - 1].scrubber === "INTAKE_ACTIVE") j--;
          stagger = (h[i].receivedAt - h[j].receivedAt) / 1000;
        }
      }
      out.push({ name: "INTAKE_ACTIVE to SCRUBBING", value: stagger === null ? "no transition in history" : `${stagger.toFixed(1)} s (2 s telemetry resolution)`, pass: stagger !== null && stagger >= 1.5 && stagger <= 4.5 });
      out.push({ name: "Diagnostic duration", value: `${Date.now() - t0} ms`, pass: true });
      setChecks(out);
    } finally {
      setRunning(false);
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      try {
        const r = await postJson<{ key: string; url: string | null }>("/api/uploads", { name: f.name, type: f.type || "image/jpeg", size: f.size });
        if (r.url) {
          const put = await fetch(r.url, { method: "PUT", body: f, headers: { "Content-Type": f.type || "image/jpeg" } });
          if (!put.ok) throw new Error(`S3 upload failed (${put.status})`);
        }
        setPhotos((x) => [...x, { key: r.key, name: f.name }]);
      } catch (e) {
        setMsg({ ok: false, t: `${f.name}: ${(e as Error).message}` });
      }
    }
  };

  const draft = { id: AUDIT_ID, solvent_ph: ph, flange_result: flange, notes, photos, signature, diagnostics: checks ?? [] };
  const save = (then?: () => Promise<void>) => async () => {
    setBusy(then ? "publish" : "save");
    setMsg(null);
    try {
      await postJson("/api/audits", draft);
      if (then) await then();
      else setMsg({ ok: true, t: "Draft saved." });
      existing.reload();
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };
  const publish = save(async () => {
    const r = await postJson<{ sha256: string }>(`/api/audits/${AUDIT_ID}/publish`, {});
    setHash(r.sha256);
    setMsg({ ok: true, t: "Report locked and published." });
  });

  return (
    <Page
      title="Safety and environmental audit workspace"
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          Active audit <Mono className="font-semibold">#{AUDIT_ID}</Mono> · Lead auditor Dr. Amina Bello (NESREA / ISO 14064) <SimTag kind="Demo" />
        </span>
      }
    >
      {!canAudit && me?.session && <Notice tone="neutral">Read only. The auditor or admin role can run diagnostics and sign off.</Notice>}
      {locked && (
        <Notice tone="ok">
          This audit is locked. PDF SHA-256 <CopyText text={hash ?? cur?.sha256 ?? ""} short={16} />
        </Notice>
      )}
      <Card title="One-click hardware diagnostic" actions={mode === "DEMO" ? <SimTag kind="Demo" /> : <Badge tone="ok">Real checks on the board</Badge>}>
        <Button variant="primary" busy={running} onClick={runDiagnostic} disabled={!canAudit}>
          <Play aria-hidden className="h-4 w-4" /> [Execute One-Click Hardware Loop Diagnostic]
        </Button>
        {checks && (
          <div className="mt-6">
            <Table head={["Check", "Result", "Status"]} caption="Diagnostic results">
              {checks.map((c) => (
                <tr key={c.name}>
                  <Td>{c.name}</Td>
                  <Td mono>{c.value}</Td>
                  <Td>
                    <Badge tone={c.pass ? "ok" : "crit"}>{c.pass ? "PASS" : "FAIL"}</Badge>
                  </Td>
                </tr>
              ))}
            </Table>
          </div>
        )}
      </Card>

      <Card title="Field observations">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Field id="au-ph" label={`Solvent pH: ${ph.toFixed(1)}`} hint="Lean NaOH about 12.4; near 8 the solution is in the bicarbonate region.">
            <input id="au-ph" type="range" min={7} max={14} step={0.1} value={ph} onChange={(e) => setPh(Number(e.target.value))} disabled={locked} />
          </Field>
          <fieldset>
            <legend className="mb-2 text-sm font-semibold">Flange gasket ultrasonic leak result</legend>
            <div className="flex flex-wrap gap-3">
              {(["Pass", "Minor leak", "Fail"] as const).map((v) => (
                <label key={v} className="flex items-center gap-2 text-sm">
                  <input type="radio" name="flange" checked={flange === v} onChange={() => setFlange(v)} disabled={locked} /> {v}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="md:col-span-2">
            <label
              htmlFor="au-files"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (!locked && canAudit) upload(e.dataTransfer.files);
              }}
              className="flex cursor-pointer flex-col items-center gap-2 rounded-md border-2 border-dashed border-line p-8 text-center text-sm text-muted hover:bg-elev"
            >
              <Upload aria-hidden className="h-6 w-6" />
              Drop FLIR thermal photos here, or choose files (JPEG, PNG, TIFF, up to 15 MB). Stored in S3 through a signed upload URL.
              <input id="au-files" type="file" accept="image/jpeg,image/png,image/tiff" multiple className="sr-only" disabled={locked || !canAudit} onChange={(e) => upload(e.target.files)} />
            </label>
            {photos.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2 text-xs">
                {photos.map((ph) => (
                  <li key={ph.key} className="rounded border border-line px-2 py-1 font-mono">
                    {ph.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Field id="au-notes" label="Notes">
            <textarea id="au-notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} disabled={locked} />
          </Field>
        </div>
      </Card>

      <Card title="Sign-off">
        <div className="flex flex-col gap-4">
          <Field id="au-sig" label="Digital signature (type your full name)">
            <input id="au-sig" value={signature} onChange={(e) => setSignature(e.target.value)} className={inputCls + " font-[cursive] text-lg"} disabled={locked} />
          </Field>
          {msg && (msg.ok ? <Notice tone="ok">{msg.t}</Notice> : <ErrorNote>{msg.t}</ErrorNote>)}
          <div className="flex flex-wrap gap-3">
            <Button onClick={save()} busy={busy === "save"} disabled={!canAudit || locked}>
              <Save aria-hidden className="h-4 w-4" /> Save Draft
            </Button>
            <Button variant="primary" onClick={publish} busy={busy === "publish"} disabled={!canAudit || locked || !signature.trim()}>
              <Lock aria-hidden className="h-4 w-4" /> Lock &amp; Publish ISO 14064 Report
            </Button>
            {locked && (
              <Button onClick={() => download(`/api/pdf/audit?id=${AUDIT_ID}`, `${AUDIT_ID}.pdf`).catch((e) => setMsg({ ok: false, t: e.message }))}>
                <FileDown aria-hidden className="h-4 w-4" /> Download report PDF
              </Button>
            )}
          </div>
        </div>
      </Card>
    </Page>
  );
}
