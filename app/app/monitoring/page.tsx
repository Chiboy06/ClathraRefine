"use client";
import { useState } from "react";
import { Card, LoadingPanel, Page, QualityBadge, SimTag, cx } from "@/components/ui";
import { DataStatus, useBoard, LevelBadge, ScrubberBadge } from "@/components/plant";
import { AnalogueBar } from "@/components/scada";
import { relayOn } from "@/lib/fsm";
import { formatTime, num } from "@/lib/format";
import { ppmFromMv } from "@/lib/mq135";
import { TAGS } from "@/lib/tags";
import type { Quality } from "@/lib/quality";

// ISA-5.1 tag IDs only — no sensor model or GPIO numbers exposed
const TAG_AMBIENT = TAGS.find((t) => t.id === "AT-101")!;
const TAG_EXHAUST = TAGS.find((t) => t.id === "AT-102")!;
const TAG_CO2_IN = TAGS.find((t) => t.id === "AT-103")!;
const TAG_CO2_OUT = TAGS.find((t) => t.id === "AT-104")!;

type SignalRow = { tag: string; name: string; value: string; unit: string; q: Quality | "Simulated"; bar?: { tag: typeof TAG_AMBIENT; value: number } };

const DOT: Record<string, string> = {
  ok: "bg-ok",
  warn: "bg-warn",
  crit: "bg-crit animate-pulse",
  off: "bg-line",
};

function StatusDot({ status }: { status: "ok" | "warn" | "crit" | "off" }) {
  return <span aria-hidden className={cx("inline-block h-2.5 w-2.5 rounded-full", DOT[status])} />;
}

function SignalTable({ rows }: { rows: SignalRow[] }) {
  return (
    <table className="w-full text-sm" aria-label="Signal values">
      <thead>
        <tr className="border-b border-line text-left text-xs text-muted">
          <th className="pb-2 pr-4 font-medium">Tag</th>
          <th className="pb-2 pr-4 font-medium">Description</th>
          <th className="pb-2 pr-4 font-mono font-medium">Value</th>
          <th className="pb-2 pr-4 font-medium">Unit</th>
          <th className="pb-2 font-medium">Quality</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {rows.map((r) => (
          <tr key={r.tag}>
            <td className="py-2 pr-4 font-mono text-xs text-muted">{r.tag}</td>
            <td className="py-2 pr-4">{r.name}</td>
            <td className="py-2 pr-4 font-mono font-semibold tabular">{r.value}</td>
            <td className="py-2 pr-4 text-muted">{r.unit}</td>
            <td className="py-2">{r.q === "Simulated" ? <SimTag /> : <QualityBadge q={r.q} />}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type DeviceId = "gas-safety" | "co2-capture" | "process" | "actuators" | "controller";

export default function Monitoring() {
  const { p, l, ambient, exhaust } = useBoard();
  const [sel, setSel] = useState<DeviceId>("gas-safety");

  if (!p.ready) return <Page title="Process monitoring"><LoadingPanel rows={6} /></Page>;

  const q = ambient.q;
  const fitted = (v: number | undefined) => v !== undefined && p.mode === "LIVE";
  const opt = (v: number | undefined, unit: string, dp: number): { value: string; unit: string; q: Quality | "Simulated" } => ({
    value: v === undefined ? "—" : num(v, dp),
    unit,
    q: fitted(v) ? q : "Simulated",
  });
  const co2ppm = (mv?: number) => (mv === undefined ? "—" : num(ppmFromMv(mv) ?? 0));

  const devices: { id: DeviceId; label: string; status: "ok" | "warn" | "crit" | "off" }[] = [
    { id: "gas-safety", label: "Gas safety", status: l?.ambient_level === "CRITICAL" ? "crit" : l?.ambient_level === "WARNING" ? "warn" : "ok" },
    { id: "co2-capture", label: "CO₂ capture", status: l?.co2_in_mv === undefined ? "off" : "ok" },
    { id: "process", label: "Process", status: fitted(l?.gas_lpm) ? "ok" : "off" },
    { id: "actuators", label: "Actuators", status: l?.trip_latched ? "crit" : l?.scram ? "crit" : "ok" },
    { id: "controller", label: "Controller", status: p.link.connected ? (l?.trip_latched ? "crit" : "ok") : "off" },
  ];

  const gasSafetyRows: SignalRow[] = [
    { tag: "AT-101", name: "Ambient gas concentration", value: num(ambient.mv), unit: "mV", q: ambient.q, bar: { tag: TAG_AMBIENT, value: ambient.mv } },
    { tag: "AT-101", name: "Ambient alarm level", value: l?.ambient_level ?? "—", unit: "", q: ambient.q },
    { tag: "AT-102", name: "Exhaust gas concentration", value: num(exhaust.mv), unit: "mV", q: exhaust.q, bar: { tag: TAG_EXHAUST, value: exhaust.mv } },
    { tag: "HS-001", name: "SCRAM status", value: l?.scram ? "ACTIVE" : "Normal", unit: "", q },
    { tag: "XA-206", name: "Trip latched", value: l?.trip_latched ? "LATCHED" : "Normal", unit: "", q },
    { tag: "AT-101", name: "Sensor fault", value: l?.sensor_fault ? "FAULT" : "OK", unit: "", q },
    { tag: "AT-101", name: "Warm-up", value: l?.warming_up ? "In progress" : "Complete", unit: "", q },
  ];

  const co2Rows: SignalRow[] = [
    { tag: "AT-103", name: "Inlet CO₂", value: co2ppm(l?.co2_in_mv), unit: "ppm", q: fitted(l?.co2_in_mv) ? q : "Simulated" },
    { tag: "AT-104", name: "Outlet CO₂", value: co2ppm(l?.co2_out_mv), unit: "ppm", q: fitted(l?.co2_out_mv) ? q : "Simulated" },
    {
      tag: "FQ-501",
      name: "CO₂ reduction",
      value: (() => {
        const i = l?.co2_in_mv === undefined ? null : ppmFromMv(l.co2_in_mv);
        const o = l?.co2_out_mv === undefined ? null : ppmFromMv(l.co2_out_mv);
        return i && o !== null ? num(((i - o) / i) * 100, 1) : "—";
      })(),
      unit: "%",
      q: fitted(l?.co2_in_mv) && fitted(l?.co2_out_mv) ? q : "Simulated",
    },
    { tag: "LT-401", name: "Solvent loading", value: num(p.solventLoadingPct, 1), unit: "%", q: "Simulated" },
    { tag: "P-202", name: "Scrubber state", value: l?.scrubber ?? "—", unit: "", q },
  ];

  const processRows: SignalRow[] = [
    { tag: "FT-301", name: "Gas flow", ...opt(l?.gas_lpm, "L/min", 2) },
    { tag: "FT-302", name: "Solvent flow", ...opt(l?.liquid_lpm, "L/min", 2) },
    { tag: "TT-303", name: "Solvent temperature", ...opt(l?.solvent_c, "°C", 1) },
    { tag: "AIT-304", name: "Solvent pH", ...opt(l?.ph, "pH", 2) },
  ];

  const RELAY_NAMES = ["Air intake fan", "Solvent pump", "Hazard light (red)", "Normal light (green)", "Pre-hazard light (yellow)", "Siren horn"];
  const RELAY_TAGS = ["XV-201", "P-202", "XL-203", "XL-204", "XL-205", "XA-206"];
  const actuatorRows: SignalRow[] = RELAY_NAMES.map((name, i) => ({
    tag: RELAY_TAGS[i],
    name,
    value: relayOn(p.relayMask, i + 1) ? "On" : "Off",
    unit: "",
    q,
  }));

  const controllerRows: SignalRow[] = [
    { tag: "HS-001", name: "Firmware version", value: l?.fw ?? "—", unit: "", q },
    { tag: "HS-001", name: "Uptime", value: l ? num(l.uptime_ms / 1000) : "—", unit: "s", q },
    { tag: "HS-001", name: "Control mode", value: l?.mode ?? "AUTO", unit: "", q },
    { tag: "HS-001", name: "Buffered reading", value: l?.buffered ? "Yes" : "No", unit: "", q },
    { tag: "HS-001", name: "Data quality", value: q, unit: "", q },
  ];

  const rowMap: Record<DeviceId, SignalRow[]> = {
    "gas-safety": gasSafetyRows,
    "co2-capture": co2Rows,
    process: processRows,
    actuators: actuatorRows,
    controller: controllerRows,
  };

  const rows = rowMap[sel];
  const barRow = rows.find((r) => r.bar);

  return (
    <Page title="Process monitoring" subtitle="Live instrument readings. ISA-5.1 tag identifiers.">
      <DataStatus />

      {/* ISA-101 style status summary strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className={cx("rounded-xl border p-4", l?.ambient_level === "CRITICAL" ? "border-crit/60 bg-crit-bg" : l?.ambient_level === "WARNING" ? "border-warn/50 bg-warn-bg" : "border-ok/50 bg-ok-bg")}>
          <div className="text-xs font-semibold text-muted">Ambient gas (AT-101)</div>
          <div className="mt-1"><LevelBadge level={l?.ambient_level} /></div>
          <div className="mt-1 font-mono text-xs text-muted tabular">{num(ambient.mv)} mV</div>
        </div>
        <div className={cx("rounded-xl border p-4", l?.scram ? "border-crit/60 bg-crit-bg" : "border-line bg-panel")}>
          <div className="text-xs font-semibold text-muted">SCRAM (HS-001)</div>
          <div className={cx("mt-1 font-semibold", l?.scram ? "text-crit-fg" : "text-ok-fg")}>{l?.scram ? "ACTIVE" : "Normal"}</div>
        </div>
        <div className="rounded-xl border border-line bg-panel p-4">
          <div className="text-xs font-semibold text-muted">Scrubber (P-202)</div>
          <div className="mt-1"><ScrubberBadge s={l?.scrubber} /></div>
        </div>
        <div className={cx("rounded-xl border p-4", p.link.connected ? "border-ok/50 bg-ok-bg" : "border-line bg-panel")}>
          <div className="text-xs font-semibold text-muted">Link status</div>
          <div className={cx("mt-1 font-semibold", p.link.connected ? "text-ok-fg" : "text-muted")}>{p.link.connected ? "Connected" : "Offline"}</div>
          <div className="mt-1 font-mono text-xs text-muted tabular">{p.link.lastAt ? formatTime(p.link.lastAt) : "No data"}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[14rem_1fr]">
        {/* Device / subsystem selector */}
        <Card title="Subsystems">
          <ul role="tree" aria-label="Subsystems" className="flex flex-col gap-1">
            {devices.map((d) => (
              <li key={d.id} role="treeitem" aria-selected={d.id === sel}>
                <button
                  onClick={() => setSel(d.id)}
                  className={cx("flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors", d.id === sel ? "bg-primary-bg text-primary-fg" : "hover:bg-elev")}
                >
                  <StatusDot status={d.status} />
                  {d.label}
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Signal detail panel */}
        <Card
          title={devices.find((d) => d.id === sel)?.label ?? ""}
          actions={<span className="text-xs text-muted">Last update {p.link.lastAt ? formatTime(p.link.lastAt) : "none"}</span>}
        >
          {barRow?.bar && (
            <div className="mb-4">
              <AnalogueBar tag={barRow.bar.tag} value={barRow.bar.value} label={`${barRow.tag} range`} />
            </div>
          )}
          <SignalTable rows={rows} />
        </Card>
      </div>
    </Page>
  );
}
