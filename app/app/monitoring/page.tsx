"use client";
import { useState } from "react";
import { Card, LoadingPanel, Page, QualityBadge, SimTag, Table, Td, cx } from "@/components/ui";
import { DataStatus, useBoard } from "@/components/plant";
import { relayOn } from "@/lib/fsm";
import { formatTime, num } from "@/lib/format";
import { ppmFromMv } from "@/lib/mq135";
import type { Quality } from "@/lib/quality";

type Signal = { name: string; value: string; unit: string; q: Quality | "Simulated" };
type Device = { id: string; name: string; model: string; status: "ok" | "warn" | "crit" | "off"; signals: Signal[] };

const DOT = { ok: "bg-ok", warn: "bg-warn", crit: "bg-crit", off: "bg-line" };
const RELAYS = ["Intake fan", "Solvent pump", "Red strobe", "Green lamp", "Yellow lamp", "Siren"];

export default function Monitoring() {
  const { p, l, ambient, exhaust } = useBoard();
  const [sel, setSel] = useState("controller");
  if (!p.ready) return <Page title="Devices and signals"><LoadingPanel rows={6} /></Page>;
  const q = ambient.q;
  const fitted = (v: number | undefined) => v !== undefined && p.mode === "LIVE";
  const opt = (v: number | undefined, unit: string, dp: number): Signal => ({ name: "", value: v === undefined ? "-" : num(v, dp), unit, q: fitted(v) ? q : "Simulated" });
  const co2 = (mv?: number) => (mv === undefined ? "-" : num(ppmFromMv(mv) ?? 0));
  const devices: Device[] = [
    { id: "controller", name: "Edge controller", model: "ESP32-S3-WROOM-1-N16R8", status: p.link.connected ? (l?.trip_latched ? "crit" : "ok") : "off", signals: [
      { name: "Firmware", value: l?.fw ?? "-", unit: "", q },
      { name: "Uptime", value: l ? num(l.uptime_ms / 1000) : "-", unit: "s", q },
      { name: "Control mode", value: l?.mode ?? "AUTO", unit: "", q },
      { name: "Trip latched", value: l?.trip_latched ? "Yes" : "No", unit: "", q },
      { name: "SCRAM", value: l?.scram ? "Yes" : "No", unit: "", q },
      { name: "Warming up", value: l?.warming_up ? "Yes" : "No", unit: "", q },
      { name: "Buffered reading", value: l?.buffered ? "Yes" : "No", unit: "", q },
    ] },
    { id: "AT-101", name: "AT-101 ambient gas", model: "MQ-2 on GPIO 2", status: l?.ambient_level === "CRITICAL" ? "crit" : l?.ambient_level === "WARNING" ? "warn" : "ok", signals: [
      { name: "Sensor output", value: num(ambient.mv), unit: "mV", q: ambient.q },
      { name: "Level", value: l?.ambient_level ?? "-", unit: "", q: ambient.q },
    ] },
    { id: "AT-102", name: "AT-102 exhaust gas", model: "MQ-2 on GPIO 1", status: exhaust.mv >= 1770 ? "warn" : "ok", signals: [{ name: "Sensor output", value: num(exhaust.mv), unit: "mV", q: exhaust.q }] },
    { id: "AT-103", name: "AT-103 inlet CO2", model: "MQ-135 on GPIO 4", status: l?.co2_in_mv === undefined ? "off" : "ok", signals: [
      { name: "CO2", value: co2(l?.co2_in_mv), unit: "ppm", q },
      { name: "Sensor output", value: l?.co2_in_mv === undefined ? "-" : num(l.co2_in_mv), unit: "mV", q },
    ] },
    { id: "AT-104", name: "AT-104 outlet CO2", model: "MQ-135 on GPIO 5", status: l?.co2_out_mv === undefined ? "off" : "ok", signals: [
      { name: "CO2", value: co2(l?.co2_out_mv), unit: "ppm", q },
      { name: "Sensor output", value: l?.co2_out_mv === undefined ? "-" : num(l.co2_out_mv), unit: "mV", q },
    ] },
    { id: "process", name: "Flow, temperature and pH", model: "Fitted when available", status: fitted(l?.gas_lpm) ? "ok" : "off", signals: [
      { ...opt(l?.gas_lpm, "L/min", 2), name: "Gas flow" },
      { ...opt(l?.liquid_lpm, "L/min", 2), name: "Solvent flow" },
      { ...opt(l?.solvent_c, "°C", 1), name: "Solvent temperature" },
      { ...opt(l?.ph, "pH", 2), name: "Solvent pH" },
    ] },
    { id: "relays", name: "Relays 1 to 6", model: "Active-LOW, GPIO 6 to 11", status: "ok", signals: RELAYS.map((r, i) => ({ name: `Relay ${i + 1} ${r}`, value: relayOn(p.relayMask, i + 1) ? "On" : "Off", unit: "", q })) },
    { id: "scrubber", name: "Scrubber", model: "Packed column, 0.025 M NaOH", status: l?.scrubber === "SCRUBBING" ? "ok" : "off", signals: [
      { name: "State", value: l?.scrubber ?? "-", unit: "", q },
      { name: "Solvent loading", value: num(p.solventLoadingPct, 1), unit: "%", q: "Simulated" },
    ] },
  ];
  const d = devices.find((x) => x.id === sel) ?? devices[0];
  return (
    <Page title="Devices and signals" subtitle="Pick a device to see its signals.">
      <DataStatus />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_1fr]">
        <Card title="Devices">
          <ul role="tree" aria-label="Devices" className="flex flex-col gap-1">
            {devices.map((x) => (
              <li key={x.id} role="treeitem" aria-selected={x.id === sel}>
                <button onClick={() => setSel(x.id)} className={cx("flex w-full items-start gap-3 rounded-lg px-3 py-2 text-left text-sm", x.id === sel ? "bg-primary-bg text-primary-fg" : "hover:bg-elev")}>
                  <span aria-hidden className={cx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", DOT[x.status])} />
                  <span>
                    <span className="block font-semibold">{x.name}</span>
                    <span className="block text-xs text-muted">{x.model}</span>
                  </span>
                  <span className="sr-only">status {x.status === "off" ? "not fitted or offline" : x.status}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
        <Card title={d.name} actions={<span className="text-xs text-muted">Last update {p.link.lastAt ? formatTime(p.link.lastAt) : "none"}</span>}>
          <Table head={["No.", "Signal", "Value", "Unit", "Quality", "Last update"]} caption={`${d.name} signals`}>
            {d.signals.map((s, i) => (
              <tr key={s.name}>
                <Td mono>{i + 1}</Td>
                <Td>{s.name}</Td>
                <Td mono>{s.value}</Td>
                <Td>{s.unit}</Td>
                <Td>{s.q === "Simulated" ? <SimTag /> : <QualityBadge q={s.q} />}</Td>
                <Td mono>{p.link.lastAt ? formatTime(p.link.lastAt) : "-"}</Td>
              </tr>
            ))}
          </Table>
        </Card>
      </div>
    </Page>
  );
}
