"use client";
import { useState } from "react";
import { Hand, Play, Power, Siren, Square, Wind } from "lucide-react";
import { Badge, Button, Card, ErrorNote, LoadingPanel, Notice, Page, Segmented, cx, postJson } from "@/components/ui";
import { Drawer, useMe } from "@/components/scada";
import { DataStatus } from "@/components/plant";
import { Mimic, type Layers } from "@/components/mimic";
import { usePlant } from "@/lib/telemetry/usePlant";
import { getHub } from "@/lib/telemetry/hub";
import { plantView, type PlantView } from "@/lib/plantView";
import { ARM_MS, sbo, type Action, type Sbo } from "@/lib/sbo";
import { can } from "@/lib/roleMatrix";
import { FW } from "@/lib/process";

/** Mirror of the board's interlocks, to explain what is allowed before anyone presses anything. The board still decides. */
function interlocksFor(v: PlantView) {
  const gas = v.exhaustMv >= FW.EXH_ON_MV;
  return {
    manualBlocked: v.tripped ? "Trip latched" : v.scram ? "SCRAM active" : gas ? "Exhaust gas active" : null,
    fanOff: gas ? "Exhaust gas active: fan must stay on" : v.tripped || v.scram ? "Trip or SCRAM: fan must stay on" : v.pumpOn ? "Stop the pump first" : null,
    pumpOn: !v.fanOn ? "Fan must be on first" : v.tripped ? "Trip latched" : null,
  };
}

export default function PlantDiagram() {
  const p = usePlant();
  const { me } = useMe();
  const [layers, setLayers] = useState<Layers>({ values: true, flow: true, alarms: true, heat: false, interlocks: true });
  const [stored, setStored] = useState<Sbo>({ phase: "idle" });
  const [err, setErr] = useState("");
  const [stopAt, setStopAt] = useState<number | null>(null);
  const allowed = can(me?.session?.role, "ack");
  if (!p.ready) return <Page title="Process diagram"><LoadingPanel rows={6} /></Page>;
  const v = plantView(p, getHub().demoForecast(30));
  const il = interlocksFor(v);

  // Derived SBO state: arm expiry, board ack and telemetry confirmation are applied on every render.
  let s = sbo(stored, { type: "tick", now: p.now });
  if (s.phase === "waiting") {
    const { sentAt, eq: target } = s;
    const ack = p.acks.find((a) => a.cmd === target && a.at >= sentAt - 1000);
    if (ack) s = sbo(s, { type: "ack", accepted: ack.accepted, reason: ack.reason });
    if (s.phase === "waiting" && (!ack || ack.accepted)) s = sbo(s, { type: "state", on: s.eq === "fan" ? v.fanOn : v.pumpOn });
  }
  const eq = s.phase === "idle" ? null : s.eq;
  // Firmware D.2 has no manual mode and no command interlocks: relays switch directly, and its own automation
  // takes over during a hazard. The app's checks are the only ones before the relay moves.
  const legacy = p.mode === "LIVE" && (p.latest?.fw ?? "").startsWith("rev-D.2");
  const isOn = eq === "fan" ? v.fanOn : v.pumpOn;

  const execute = async () => {
    if (s.phase !== "armed") return;
    const action = s.action;
    const target = s.eq;
    const blocked = target === "fan" && action === "off" ? il.fanOff : target === "pump" && action === "on" ? il.pumpOn : null;
    if (blocked) {
      setStored({ phase: "rejected", eq: target, action, reason: blocked });
      return;
    }
    const now = Date.now();
    setStored(sbo(s, { type: "execute", now }));
    setErr("");
    try {
      await postJson("/api/command", { cmd: target, value: action, mode: p.mode });
      if (p.mode === "DEMO") getHub().commandDemo({ cmd: target, value: action });
    } catch (e) {
      setStored({ phase: "rejected", eq: target, action, reason: (e as Error).message });
    }
  };
  const setMode = async (value: "manual" | "auto") => {
    setErr("");
    try {
      await postJson("/api/command", { cmd: "mode", value, mode: p.mode });
      if (p.mode === "DEMO") getHub().commandDemo({ cmd: "mode", value });
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const lastModeAck = p.acks.find((a) => a.cmd === "mode");
  const lastStopAck = p.acks.find((a) => a.cmd === "stop");
  // Press, then confirm within 4 s: one stray click must not stop extraction.
  const stopArmed = stopAt !== null && p.now - stopAt < 4000;
  const stopAll = async () => {
    if (!stopArmed) return setStopAt(Date.now());
    setStopAt(null);
    setErr("");
    try {
      if (p.mode === "DEMO") {
        getHub().commandDemo({ cmd: "pump", value: "off" });
        getHub().commandDemo({ cmd: "fan", value: "off" });
      } else await postJson("/api/command", { cmd: "stop", value: "all", mode: p.mode });
    } catch (e) {
      setErr((e as Error).message);
    }
  };
  const armLeft = s.phase === "armed" ? Math.max(0, Math.ceil((ARM_MS - (p.now - s.armedAt)) / 1000)) : 0;

  return (
    <Page
      title="Process diagram"
      subtitle="Live values on the equipment. Select the fan or pump to operate it."
      actions={
        p.mode === "DEMO" && (
          <>
            <Button onClick={() => getHub().setGasSource(!p.gasSource)} data-testid="gas-source">
              <Wind aria-hidden className="h-4 w-4" /> Flue gas source (Demo): {p.gasSource ? "On" : "Off"}
            </Button>
            <Button onClick={() => getHub().triggerLeak()} disabled={p.leakActive}>
              <Siren aria-hidden className="h-4 w-4" /> Trigger leak
            </Button>
            <Button onClick={() => getHub().pressAckDemo()}>
              <Hand aria-hidden className="h-4 w-4" /> Press board ACK (simulated)
            </Button>
          </>
        )
      }
    >
      <DataStatus />
      <div data-theme="night" className="rounded-2xl border border-line bg-canvas p-4 text-fg">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {(Object.keys(layers) as (keyof Layers)[]).map((k) => (
            <label key={k} className={cx("inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-xs", layers[k] ? "border-primary text-primary-fg" : "border-line text-muted")}>
              <input type="checkbox" className="h-3.5 w-3.5" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} />
              {k === "heat" ? "Gas heat map" : k === "flow" ? "Flow animation" : k[0].toUpperCase() + k.slice(1)}
            </label>
          ))}
          <span className="ml-auto">
            <Badge tone={v.boardMode === "MANUAL" ? "warn" : "ok"}>Control: {v.boardMode === "MANUAL" ? "Manual" : "Automatic"}</Badge>
          </span>
        </div>
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <Mimic v={v} layers={layers} selected={eq} onSelect={(e) => setStored(sbo(stored, { type: "select", eq: e }))} interlocks={{ fan: v.fanOn ? il.fanOff : null, pump: v.pumpOn ? null : il.pumpOn }} />
          </div>
        </div>
      </div>

      <Card title="Control mode" help="Manual mode lets you start and stop the fan and pump. Automatic safety always wins: exhaust gas, a critical level, a sensor fault, a trip or SCRAM returns the board to automatic, and so does 10 minutes without a command.">
        {legacy ? (
          <p className="text-sm">
            This board runs firmware rev D.2, which has no manual mode. Fan and pump commands switch the relay directly, after the checks on this page, and the board&apos;s automatic safety takes over during any hazard.
          </p>
        ) : (
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            label="Control mode"
            value={v.boardMode === "MANUAL" ? "manual" : "auto"}
            onChange={(m) => allowed && setMode(m)}
            options={[
              { value: "auto", label: "Automatic" },
              { value: "manual", label: "Manual" },
            ]}
          />
          {il.manualBlocked && v.boardMode === "AUTO" && <span className="text-sm text-warn-fg">Manual not allowed now: {il.manualBlocked}</span>}
          {lastModeAck && !lastModeAck.accepted && (
            <span role="alert" className="text-sm text-crit-fg" data-testid="mode-rejected">
              Rejected: {lastModeAck.reason}
            </span>
          )}
          {!allowed && <span className="text-sm text-muted">Operators and supervisors can operate equipment.</span>}
        </div>
        )}
        {err && <div className="mt-3"><ErrorNote>{err}</ErrorNote></div>}
      </Card>

      <Card title="Stop fan and pumps" help="Sends one stop command: the intake fan and both pumps switch off. The red and green lamps and the siren stay under the board's own safety control. If gas is detected or a trip is latched, the board starts extraction again by itself, as it should.">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant={stopArmed ? "danger" : undefined} disabled={!allowed} onClick={stopAll} data-testid="stop-all">
            <Square aria-hidden className="h-4 w-4" /> {stopArmed ? "Confirm: stop fan and pumps" : "Stop fan and pumps"}
          </Button>
          {lastStopAck && (
            <span className="text-sm text-muted" role="status">
              {lastStopAck.accepted ? "Board accepted stop" : `Board refused stop: ${lastStopAck.reason}`}
            </span>
          )}
        </div>
      </Card>

      <Drawer open={!!eq} onClose={() => setStored({ phase: "idle" })} title={eq === "fan" ? "Intake fan XV-201" : "Solvent pump P-202"}>
        {eq && (
          <div className="flex flex-col gap-4" data-testid="sbo-panel">
            <div className="flex items-center gap-2">
              <Badge tone={isOn ? "fluid" : "neutral"} size="lg">
                {isOn ? "Running" : "Stopped"}
              </Badge>
              <Badge tone={v.boardMode === "MANUAL" ? "warn" : "neutral"}>{v.boardMode === "MANUAL" ? "Manual" : "Automatic"}</Badge>
            </div>
            <section aria-label="Interlocks">
              <h3 className="mb-2 text-sm font-semibold">Interlocks</h3>
              <ul className="flex flex-col gap-1 text-sm">
                <li>{v.boardMode === "MANUAL" ? "Manual mode: commands allowed" : "Automatic mode: switch to manual to operate"}</li>
                {eq === "fan" ? <li>Stop: {il.fanOff ?? "allowed"}</li> : <li>Start: {il.pumpOn ?? "allowed"}</li>}
                <li>The board checks again and refuses anything unsafe.</li>
              </ul>
            </section>
            {s.phase === "selected" && s.note && <Notice tone="warn">{s.note}</Notice>}
            {(s.phase === "selected" || s.phase === "confirmed" || s.phase === "rejected") && (
              <div className="grid grid-cols-2 gap-2">
                <Button disabled={!allowed} onClick={() => setStored(sbo(s, { type: "arm", action: "on" as Action, now: Date.now() }))}>
                  <Play aria-hidden className="h-4 w-4" /> Start
                </Button>
                <Button disabled={!allowed} onClick={() => setStored(sbo(s, { type: "arm", action: "off" as Action, now: Date.now() }))}>
                  <Square aria-hidden className="h-4 w-4" /> Stop
                </Button>
              </div>
            )}
            {s.phase === "armed" && (
              <div className="flex flex-col gap-2">
                <Notice tone="warn">
                  {s.action === "on" ? "Start" : "Stop"} armed. Execute within {armLeft} s.
                </Notice>
                <Button variant="primary" onClick={execute} data-testid="sbo-execute">
                  <Power aria-hidden className="h-4 w-4" /> Execute
                </Button>
                <Button onClick={() => setStored({ phase: "selected", eq: s.eq })}>Cancel</Button>
              </div>
            )}
            {s.phase === "waiting" && (
              <Notice tone="primary">
                <span data-testid="sbo-status">Waiting for confirmation from telemetry…</span>
              </Notice>
            )}
            {s.phase === "confirmed" && (
              <Notice tone="ok">
                <span data-testid="sbo-status">Confirmed: {s.eq} {s.action === "on" ? "running" : "stopped"}.</span>
              </Notice>
            )}
            {s.phase === "rejected" && (
              <Notice tone="crit">
                <span data-testid="sbo-status">Rejected: {s.reason}</span>
              </Notice>
            )}
            {!allowed && <p className="text-sm text-muted">Your role can view only. Operators and supervisors can operate equipment.</p>}
          </div>
        )}
      </Drawer>
    </Page>
  );
}
