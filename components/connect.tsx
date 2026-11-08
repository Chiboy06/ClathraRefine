"use client";
import { useEffect, useRef, useState } from "react";
import { Download, KeyRound, PlugZap, Save } from "lucide-react";
import { Badge, Button, Card, ErrorNote, Field, inputCls, Notice, Page, SimTag, download, postJson } from "./ui";
import { Mono, useMe } from "./scada";
import { usePrefs } from "@/lib/store";
import { usePlant } from "@/lib/telemetry/usePlant";
import { formatTime } from "@/lib/format";

const REGIONS = [
  { v: "eu-west-1", l: "eu-west-1 (Ireland), IoT Core for this project" },
  { v: "eu-central-1", l: "eu-central-1 (Frankfurt)" },
  { v: "us-east-1", l: "us-east-1 (N. Virginia)" },
  { v: "af-south-1", l: "af-south-1 (Cape Town): IoT Core not offered" },
];

type Line = { at: number; text: string; tone?: "ok" | "warn" | "crit" };
const T0 = Date.now();
const DEMO_LOG: Line[] = [
  { at: T0 - 5000, text: "[sim] TLS 1.2 handshake with xxxx-ats.iot.eu-west-1.amazonaws.com:8883" },
  { at: T0 - 4800, text: "[sim] MQTT CONNECT client_id=ESP32S3-N16R8-HARNESS-01", tone: "ok" },
  { at: T0 - 4700, text: "[sim] SUBSCRIBE clathrarefine/ESP32S3-N16R8-HARNESS-01/cmd qos=1", tone: "ok" },
  { at: T0 - 4000, text: "[sim] PUBLISH telemetry every 2 s, buffer 0" },
];
type DevEvent = { ingest_ms: number; cmd?: string; accepted?: boolean; ambient_level?: string; scrubber?: string; trip_latched?: boolean };

export function ConnectDevice({ embedded = false }: { embedded?: boolean }) {
  const { me } = useMe();
  const mode = usePrefs((s) => s.mode);
  const p = usePlant();
  const [f, setF] = useState({ facility: "Niger Delta Mini-Refinery Complex #04", station: "CLR-REF-NG-9842", region: "eu-west-1", endpoint: "", thing: "ESP32S3-N16R8-HARNESS-01", topic: "clathrarefine/ESP32S3-N16R8-HARNESS-01/telemetry" });
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [deviceLines, setDeviceLines] = useState<Line[]>([]);
  const [local, setLocal] = useState<Line[]>([]);
  const [latency, setLatency] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);
  const [certErr, setCertErr] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const push = (l: Omit<Line, "at">) => setLocal((x) => [...x.slice(-80), { at: Date.now(), ...l }]);
  const lines = [...(mode === "DEMO" ? DEMO_LOG : deviceLines), ...local];

  // Connection log: device events in LIVE, scenario link events in DEMO.
  useEffect(() => {
    if (mode === "DEMO") return;
    let alive = true;
    const load = async () => {
      try {
        const r = await fetch("/api/events?limit=30", { cache: "no-store" });
        if (!r.ok) throw new Error(await r.text());
        const rows = (await r.json()) as DevEvent[];
        if (!alive) return;
        setDeviceLines(
          rows
            .slice()
            .reverse()
            .map((e) => ({
              at: e.ingest_ms,
              text: e.cmd ? `cmd/ack ${e.cmd} accepted=${e.accepted}` : `events level=${e.ambient_level} scrubber=${e.scrubber} trip=${e.trip_latched}`,
              tone: e.trip_latched ? "crit" : e.cmd ? "ok" : undefined,
            })),
        );
      } catch (e) {
        if (alive) setDeviceLines([{ at: Date.now(), text: `Cannot read device events: ${(e as Error).message}`, tone: "crit" }]);
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [mode]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [deviceLines, local, mode]);

  const testConnection = async () => {
    setTesting(true);
    setLatency(null);
    try {
      const r = await postJson<{ sent_at: number; request_id: string }>("/api/ping", { mode });
      push({ text: `PUBLISH cmd {"cmd":"ping"} request ${r.request_id}` });
      if (mode === "DEMO") {
        const ms = 12 + Math.round(Math.random() * 5);
        await new Promise((res) => setTimeout(res, ms));
        setLatency(ms);
        push({ text: `[sim] cmd/ack ping accepted=true, round trip ${ms} ms`, tone: "ok" });
        return;
      }
      // Wait up to 10 s for the ack stored by the AckToStore rule.
      for (let i = 0; i < 20; i++) {
        await new Promise((res) => setTimeout(res, 500));
        const ev = (await (await fetch("/api/events?limit=10", { cache: "no-store" })).json()) as DevEvent[];
        const ack = ev.find((e) => e.cmd === "ping" && e.ingest_ms >= r.sent_at);
        if (ack) {
          setLatency(ack.ingest_ms - r.sent_at);
          push({ text: `cmd/ack ping accepted=${ack.accepted}, round trip ${ack.ingest_ms - r.sent_at} ms`, tone: "ok" });
          return;
        }
      }
      push({ text: "No cmd/ack within 10 s. Check the board, Wi-Fi and the AckToStore rule.", tone: "crit" });
    } catch (e) {
      push({ text: `Ping failed: ${(e as Error).message}`, tone: "crit" });
    } finally {
      setTesting(false);
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveMsg(null);
    try {
      await postJson("/api/sites", f);
      setSaveMsg({ ok: true, t: "Site and device record saved." });
    } catch (x) {
      setSaveMsg({ ok: false, t: (x as Error).message });
    }
  };

  const body = (
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <Card title="Provisioning">
          <form onSubmit={save} className="flex flex-col gap-5">
            <Field id="ob-fac" label="Facility Name">
              <input id="ob-fac" required value={f.facility} onChange={(e) => setF({ ...f, facility: e.target.value })} className={inputCls} />
            </Field>
            <Field id="ob-st" label="Station ID">
              <input id="ob-st" required value={f.station} onChange={(e) => setF({ ...f, station: e.target.value })} className={inputCls + " font-mono"} />
            </Field>
            <Field id="ob-reg" label="AWS Region" hint={f.region === "af-south-1" ? "AWS IoT Core is not offered in af-south-1. Use eu-west-1." : "IoT Core for this project runs in eu-west-1."}>
              <select id="ob-reg" value={f.region} onChange={(e) => setF({ ...f, region: e.target.value })} className={inputCls}>
                {REGIONS.map((r) => (
                  <option key={r.v} value={r.v}>
                    {r.l}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="ob-ep" label="AWS IoT Endpoint URL" hint="AWS IoT Core > Settings > Device data endpoint">
              <input id="ob-ep" value={f.endpoint} onChange={(e) => setF({ ...f, endpoint: e.target.value })} placeholder="xxxxxxxxxxxxxx-ats.iot.eu-west-1.amazonaws.com" className={inputCls + " font-mono"} />
            </Field>
            <Field id="ob-th" label="Thing Name">
              <input
                id="ob-th"
                required
                value={f.thing}
                onChange={(e) => setF({ ...f, thing: e.target.value, topic: `clathrarefine/${e.target.value}/telemetry` })}
                className={inputCls + " font-mono"}
              />
            </Field>
            <Field id="ob-topic" label="MQTT Topic">
              <input id="ob-topic" required value={f.topic} onChange={(e) => setF({ ...f, topic: e.target.value })} className={inputCls + " font-mono"} />
            </Field>
            {saveMsg && (saveMsg.ok ? <Notice tone="ok">{saveMsg.t}</Notice> : <ErrorNote>{saveMsg.t}</ErrorNote>)}
            <Button variant="primary" type="submit" disabled={!me?.session}>
              <Save aria-hidden className="h-4 w-4" /> Save site and device
            </Button>
          </form>
        </Card>
        <Card title="Live connection diagnostics" actions={mode === "DEMO" ? <SimTag kind="Demo" /> : <Badge tone={p.link.connected ? "ok" : "crit"}>{p.link.connected ? "Receiving" : "No data"}</Badge>}>
          <div ref={logRef} role="log" aria-label="Connection log" className="h-72 overflow-y-auto rounded-md border border-line bg-[#05080f] p-4 font-mono text-xs text-slate-200">
            {lines.map((l, i) => (
              <div key={i} className={l.tone === "ok" ? "text-emerald-400" : l.tone === "crit" ? "text-red-400" : l.tone === "warn" ? "text-amber-300" : undefined}>
                <span className="text-slate-400">{formatTime(l.at)}</span> {l.text}
              </div>
            ))}
            {!lines.length && <div className="text-slate-400">No device events yet.</div>}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div>
              <div className="text-xs text-muted">Ping round trip</div>
              <Mono className="text-2xl font-bold">{latency !== null ? `${latency} ms` : mode === "DEMO" ? "≈14 ms" : "-"}</Mono>
            </div>
            <Button variant="primary" busy={testing} onClick={testConnection}>
              <PlugZap aria-hidden className="h-4 w-4" /> Test AWS Connection
            </Button>
          </div>
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => download("/api/certs?file=device", "device-certificate.pem.crt").catch((e) => setCertErr(e.message))}>
                <Download aria-hidden className="h-4 w-4" /> Download Device Certificates (.PEM)
              </Button>
              <Button onClick={() => download("/api/certs?file=rootca", "AmazonRootCA1.pem").catch((e) => setCertErr(e.message))}>
                <Download aria-hidden className="h-4 w-4" /> Amazon Root CA 1
              </Button>
            </div>
            <Notice tone="neutral">
              <KeyRound aria-hidden className="mr-1 inline h-4 w-4" />
              Only the public device certificate and Amazon Root CA 1 are served here. The private key stays with the device owner and never passes through this app.
            </Notice>
            {certErr && <ErrorNote>{certErr}</ErrorNote>}
          </div>
        </Card>
      </div>
  );
  return embedded ? body : (
    <Page title="Connect a device" subtitle="Register the site and device, check the AWS link and download the public certificates.">
      {body}
    </Page>
  );
}
