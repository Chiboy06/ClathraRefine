"use client";
import { useEffect, useMemo, useState } from "react";
import { Card, Segmented, cx } from "./ui";
import { TrendChart } from "./scada";
import { usePlant } from "@/lib/telemetry/usePlant";
import { usePrefs } from "@/lib/store";
import { convex } from "@/lib/convexClient";
import { api } from "@/convex/_generated/api";
import { demoSeries, fromRollups, fromSamples, SIGNALS, type Point } from "@/lib/series";
import { FW } from "@/lib/process";

export const RANGES = { "15m": 900_000, "1h": 3_600_000, "24h": 86_400_000, "7d": 7 * 86_400_000 } as const;
export type Range = keyof typeof RANGES;
const THING = "ESP32S3-N16R8-HARNESS-01";

/** Points for any window: session readings for the last 2 h, hourly history beyond that. */
export function useSeries(from: number, to: number): { points: Point[]; source: string } {
  const p = usePlant();
  const mode = usePrefs((s) => s.mode);
  const [rollups, setRollups] = useState<{ key: string; points: Point[] }>({ key: "", points: [] });
  const live = useMemo(() => fromSamples(p.history), [p.history]);
  const recentOnly = to - from <= 2 * 3_600_000 && to >= (p.now || to) - 60_000;
  const key = `${mode}|${Math.floor(from / 3_600_000)}|${Math.floor(to / 3_600_000)}`;
  useEffect(() => {
    if (mode !== "LIVE" || recentOnly || !convex) return;
    let alive = true;
    convex
      .query(api.telemetry.rollups, { device: THING, from, to })
      .then((rows) => alive && setRollups({ key, points: fromRollups(rows) }))
      .catch(() => alive && setRollups({ key, points: [] }));
    return () => {
      alive = false;
    };
  }, [mode, recentOnly, from, to, key]);
  return useMemo(() => {
    if (recentOnly) return { points: live.filter((x) => x.t >= from), source: mode === "LIVE" ? "Board" : "Scenario" };
    if (mode === "DEMO") return { points: demoSeries(from, to, Math.max(60_000, Math.round((to - from) / 500))), source: "Demo history" };
    return { points: rollups.key === key ? rollups.points : [], source: "Hourly history" };
  }, [recentOnly, live, from, to, mode, rollups, key]);
}

const GROUPS = {
  co2: { label: "CO2", series: [{ key: "co2_in", color: "var(--warn)" }, { key: "co2_out", color: "var(--fluid)" }], unit: " ppm" },
  reduction: { label: "Reduction", series: [{ key: "reduction", color: "var(--ok)" }], unit: " %" },
  flows: { label: "Flows", series: [{ key: "gas_lpm", color: "var(--primary)" }, { key: "liquid_lpm", color: "var(--fluid)" }], unit: " L/min" },
  temp: { label: "Temperature and pH", series: [{ key: "solvent_c", color: "var(--crit)" }, { key: "ph", color: "var(--primary)" }], unit: "" },
  gas: { label: "Gas safety", series: [{ key: "ambient", color: "var(--fluid)" }, { key: "exhaust", color: "var(--primary)" }], unit: " mV" },
} as const;
type Group = keyof typeof GROUPS;

/** One main trend chart with a series switch and a range picker. */
export function MainTrend({ title = "Trend" }: { title?: string }) {
  const p = usePlant();
  const [group, setGroup] = useState<Group>("co2");
  const [range, setRange] = useState<Range>("15m");
  const now = p.now || 0;
  const { points, source } = useSeries(now - RANGES[range], now);
  const g = GROUPS[group];
  return (
    <Card
      title={title}
      help={`Source: ${source}. 15 min and 1 h use this session's readings; 24 h and 7 d use hourly history.`}
      actions={
        <>
          <Segmented label="Series" value={group} onChange={setGroup} options={(Object.keys(GROUPS) as Group[]).map((k) => ({ value: k, label: GROUPS[k].label }))} />
          <Segmented label="Range" value={range} onChange={setRange} options={(Object.keys(RANGES) as Range[]).map((r) => ({ value: r, label: r === "15m" ? "15 min" : r }))} />
        </>
      }
    >
      <TrendChart
        data={points as unknown as Record<string, number>[]}
        unit={g.unit}
        series={g.series.map((s) => ({ key: s.key, name: SIGNALS[s.key].label, color: s.color }))}
        limits={group === "gas" ? [{ y: FW.AMB_WARN_ON_MV, label: "Warning 1,410", color: "var(--warn)" }, { y: FW.AMB_CRIT_ON_MV, label: "Trip 2,710", color: "var(--crit)" }] : []}
      />
    </Card>
  );
}

export function SignalPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Signals</legend>
      {Object.entries(SIGNALS).map(([k, s]) => (
        <label key={k} className={cx("inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1 text-sm", value.includes(k) ? "border-primary bg-primary-bg text-primary-fg" : "border-line text-muted")}>
          <input type="checkbox" className="h-3.5 w-3.5" checked={value.includes(k)} onChange={(e) => onChange(e.target.checked ? [...value, k] : value.filter((x) => x !== k))} />
          {s.label}
        </label>
      ))}
    </fieldset>
  );
}
