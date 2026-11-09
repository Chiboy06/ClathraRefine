"use client";
import { useState } from "react";
import { CheckCircle2, Copy, PlugZap, Save } from "lucide-react";
import { Badge, Button, ErrorNote, Field, Notice, Page, cx, inputCls, postJson } from "./ui";
import { useMe } from "./scada";
import { usePlant } from "@/lib/telemetry/usePlant";
import { getHub } from "@/lib/telemetry/hub";

const REGIONS = [
  { v: "eu-west-1", l: "eu-west-1 (Ireland)" },
  { v: "eu-central-1", l: "eu-central-1 (Frankfurt)" },
  { v: "us-east-1", l: "us-east-1 (N. Virginia)" },
];
const SENSORS = [
  { id: "mq2_ambient", label: "MQ-2 ambient gas", pin: "GPIO 2" },
  { id: "mq2_exhaust", label: "MQ-2 exhaust gas", pin: "GPIO 1" },
  { id: "mq135_in", label: "MQ-135 inlet CO2", pin: "GPIO 4" },
  { id: "mq135_out", label: "MQ-135 outlet CO2", pin: "GPIO 5" },
  { id: "flow", label: "Flow meters", pin: "Not assigned" },
  { id: "temp_ph", label: "Temperature and pH", pin: "Not assigned" },
];
const ingestUrl = process.env.NEXT_PUBLIC_CONVEX_SITE_URL ? `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL}/ingest` : null;

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-panel p-5" aria-labelledby={`step-${n}`}>
      <h2 id={`step-${n}`} className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <span className={cx("flex h-6 w-6 items-center justify-center rounded-full text-xs", done ? "bg-ok text-white" : "bg-elev text-fg")}>{done ? <CheckCircle2 aria-hidden className="h-4 w-4" /> : n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Connect a device, step by step. AWS provisioning and certificates are done in the AWS console, not here. */
export function ConnectDevice({ embedded = false }: { embedded?: boolean }) {
  const { me } = useMe();
  const p = usePlant();
  const [f, setF] = useState({ facility: "ClathraRefine capture skid", station: "CLR-REF-NG-9842", region: "eu-west-1", endpoint: "", thing: "ESP32S3-N16R8-HARNESS-01" });
  const [fitted, setFitted] = useState<string[]>(["mq2_ambient", "mq2_exhaust", "mq135_in", "mq135_out"]);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [test, setTest] = useState<{ state: "idle" | "testing" | "ok" | "fail"; text?: string }>({ state: "idle" });
  const [copied, setCopied] = useState(false);
  // Readings newer than the last one present when the page opened.
  const [openedAt] = useState(() => p.history.at(-1)?.receivedAt ?? 0);
  const firstData = p.history.filter((h) => h.receivedAt > openedAt).length;
  const sinceLast = p.link.lastAt && p.now ? Math.max(0, Math.round((p.now - p.link.lastAt) / 1000)) : null;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMsg(null);
    try {
      await postJson("/api/sites", { ...f, topic: `clathrarefine/${f.thing}/telemetry` });
      setSaveMsg({ ok: true, t: "Site and device saved." });
    } catch (x) {
      setSaveMsg({ ok: false, t: (x as Error).message });
    }
  };

  // Sends {"cmd":"ping"} and waits up to 10 s for cmd/ack (through Convex in LIVE; the scenario answers in DEMO).
  const testConnection = async () => {
    setTest({ state: "testing" });
    const sent = Date.now();
    try {
      await postJson("/api/ping", { mode: p.mode });
      if (p.mode === "DEMO") setTimeout(() => getHub().addAck({ cmd: "ping", accepted: true, at: Date.now() }), 14);
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 500));
        const ack = getHub().getSnapshot().acks.find((a) => a.cmd === "ping" && a.at >= sent);
        if (ack) {
          const last = getHub().getSnapshot().link.lastAt;
          return setTest({ state: "ok", text: `Connected: round trip ${ack.at - sent} ms; last message ${last ? Math.max(0, Math.round((Date.now() - last) / 1000)) : "-"} s ago.` });
        }
      }
      setTest({ state: "fail", text: "No reply within 10 s. Likely causes: board off or on another Wi-Fi, venue network blocking port 8883, wrong thing name, or the IoT rule for cmd/ack not added." });
    } catch (e) {
      setTest({ state: "fail", text: `${(e as Error).message}. In LIVE mode the app publishes through AWS IoT: check AWS_ROLE_ARN and IOT_ENDPOINT on the server.` });
    }
  };

  const body = (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_22rem]">
      <form onSubmit={save} className="flex flex-col gap-4">
        <Step n={1} title="Site name and location">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field id="ob-fac" label="Site name">
              <input id="ob-fac" required value={f.facility} onChange={(e) => setF({ ...f, facility: e.target.value })} className={inputCls} />
            </Field>
            <Field id="ob-st" label="Station ID">
              <input id="ob-st" required value={f.station} onChange={(e) => setF({ ...f, station: e.target.value })} className={inputCls + " font-mono"} />
            </Field>
          </div>
        </Step>
        <Step n={2} title="Thing name">
          <Field id="ob-th" label="Thing name" hint="Must match the AWS IoT thing and THING_NAME in the firmware.">
            <input id="ob-th" required value={f.thing} onChange={(e) => setF({ ...f, thing: e.target.value })} className={inputCls + " font-mono"} />
          </Field>
        </Step>
        <Step n={3} title="AWS region and IoT endpoint">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field id="ob-reg" label="AWS region">
              <select id="ob-reg" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} className={inputCls}>
                {REGIONS.map((r) => (
                  <option key={r.v} value={r.v}>
                    {r.l}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="ob-ep" label="IoT endpoint" hint="AWS IoT Core › Settings › Device data endpoint">
              <input id="ob-ep" value={f.endpoint} onChange={(e) => setF({ ...f, endpoint: e.target.value })} placeholder="xxxx-ats.iot.eu-west-1.amazonaws.com" className={inputCls + " font-mono"} />
            </Field>
          </div>
        </Step>
        <Step n={4} title="Sensors fitted">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SENSORS.map((s) => (
              <li key={s.id}>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={fitted.includes(s.id)} onChange={(e) => setFitted(e.target.checked ? [...fitted, s.id] : fitted.filter((x) => x !== s.id))} className="h-4 w-4" />
                  {s.label} <span className="font-mono text-xs text-muted">{s.pin}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="primary" type="submit" disabled={!me?.session}>
              <Save aria-hidden className="h-4 w-4" /> Save site and device
            </Button>
            {saveMsg && (saveMsg.ok ? <span className="text-sm text-ok-fg">{saveMsg.t}</span> : <ErrorNote>{saveMsg.t}</ErrorNote>)}
          </div>
        </Step>
        <Step n={5} title="Test connection" done={test.state === "ok"}>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="primary" busy={test.state === "testing"} onClick={testConnection} data-testid="test-connection">
              <PlugZap aria-hidden className="h-4 w-4" /> Test connection
            </Button>
            {p.mode === "DEMO" && <Badge tone="warn">DEMO: answered by the scenario</Badge>}
          </div>
          {test.text && (
            <div className="mt-3" data-testid="test-result">
              {test.state === "ok" ? <Notice tone="ok">{test.text}</Notice> : <ErrorNote>{test.text}</ErrorNote>}
            </div>
          )}
        </Step>
        <Step n={6} title="Waiting for first data" done={firstData > 0}>
          <div className={cx("flex items-center gap-3 rounded-xl border p-4", firstData > 0 ? "border-ok/50 bg-ok-bg text-ok-fg" : "border-line")} role="status" aria-live="polite">
            <span className="font-mono text-2xl tabular">{firstData}</span>
            <span className="text-sm">{firstData > 0 ? `readings received; last ${sinceLast ?? 0} s ago` : "readings since you opened this page. The board sends one every 2 s."}</span>
          </div>
        </Step>
      </form>
      <aside className="h-fit rounded-2xl border border-line bg-panel p-5 text-sm xl:sticky xl:top-36" aria-label="AWS IoT rule checklist">
        <h2 className="mb-3 font-semibold">AWS IoT rule checklist</h2>
        <ol className="flex list-decimal flex-col gap-2 pl-5 text-muted">
          <li>
            In AWS IoT Core › Message routing › Rules, create a rule with SQL:
            <code className="mt-1 block rounded bg-elev p-2 font-mono text-xs text-fg">SELECT *, topic(2) AS device, topic() AS topic FROM &apos;clathrarefine/+/telemetry&apos;</code>
          </li>
          <li>Add rules for <span className="font-mono">clathrarefine/+/events</span> and <span className="font-mono">clathrarefine/+/cmd/ack</span>, or one rule each.</li>
          <li>
            Action: HTTPS to
            {ingestUrl ? (
              <span className="mt-1 flex items-center gap-2">
                <code className="break-all rounded bg-elev p-1.5 font-mono text-xs text-fg">{ingestUrl}</code>
                <button type="button" aria-label="Copy ingest URL" onClick={() => navigator.clipboard.writeText(ingestUrl).then(() => setCopied(true))} className="rounded p-1 hover:bg-elev">
                  <Copy aria-hidden className="h-4 w-4" />
                </button>
                {copied && <span className="text-xs text-ok-fg">Copied</span>}
              </span>
            ) : (
              <span className="block text-warn-fg">Convex is not configured on this build.</span>
            )}
          </li>
          <li>
            Add header <span className="font-mono">x-ingest-key</span> with the value of <span className="font-mono">INGEST_KEY</span> from the Convex dashboard. It is never shown in this app.
          </li>
          <li>Confirm the destination: AWS sends a confirmation request that the ingest endpoint accepts on its own.</li>
          <li>Keep the S3 archive action for model training.</li>
        </ol>
      </aside>
    </div>
  );
  return embedded ? body : (
    <Page title="Connect a device" subtitle="Register the device, then check the link and the first readings.">
      {body}
    </Page>
  );
}
