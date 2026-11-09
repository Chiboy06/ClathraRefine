// Time series for the trend chart and History. Short ranges come from this session's readings; long ranges from
// Convex hourly rollups (LIVE) or a deterministic DEMO generator. Pure functions.
import { ppmFromMv } from "./mq135";
import type { Sample } from "./telemetry/types";

export type Point = { t: number; co2_in?: number; co2_out?: number; reduction?: number; gas_lpm?: number; liquid_lpm?: number; solvent_c?: number; ph?: number; ambient?: number; exhaust?: number; alarms?: number; captured_g?: number };

export const SIGNALS: Record<string, { label: string; unit: string }> = {
  co2_in: { label: "Inlet CO2", unit: "ppm" },
  co2_out: { label: "Outlet CO2", unit: "ppm" },
  reduction: { label: "CO2 reduction", unit: "%" },
  gas_lpm: { label: "Gas flow", unit: "L/min" },
  liquid_lpm: { label: "Solvent flow", unit: "L/min" },
  solvent_c: { label: "Solvent temperature", unit: "°C" },
  ph: { label: "Solvent pH", unit: "pH" },
  ambient: { label: "Ambient gas (AT-101)", unit: "mV" },
  exhaust: { label: "Exhaust gas (AT-102)", unit: "mV" },
};

export function fromSamples(h: Sample[]): Point[] {
  return h.map((s) => {
    const i = s.co2_in_mv === undefined ? undefined : ppmFromMv(s.co2_in_mv) ?? undefined;
    const o = s.co2_out_mv === undefined ? undefined : ppmFromMv(s.co2_out_mv) ?? undefined;
    return { t: s.receivedAt, co2_in: i, co2_out: o, reduction: i && o !== undefined ? +(((i - o) / i) * 100).toFixed(2) : undefined, gas_lpm: s.gas_lpm, liquid_lpm: s.liquid_lpm, solvent_c: s.solvent_c, ph: s.ph, ambient: s.ambient_mv, exhaust: s.exhaust_mv };
  });
}

const w = (t: number, a: number, p: number) => a * Math.sin(t / p) + (a / 3) * Math.sin(t / (p * 0.37));

/** DEMO history: daily solvent cycles (breakthrough rises, solvent replaced at 06:00 UTC), working-hours gas flow, rare leaks. */
export function demoSeries(from: number, to: number, stepMs: number): Point[] {
  const out: Point[] = [];
  for (let t = Math.floor(from / stepMs) * stepMs; t <= to; t += stepMs) {
    const hour = (t / 3_600_000) % 24;
    const cycle = ((hour - 6 + 24) % 24) / 24; // 0 right after the 06:00 solvent change
    const running = hour >= 6 && hour < 22;
    const co2In = running ? 8000 + w(t / 1000, 300, 2300) : 450 + w(t / 1000, 10, 900);
    const ratio = running ? 0.08 + 0.92 / (1 + Math.exp(-(cycle - 0.85) * 12)) : 0.97;
    const co2Out = co2In * ratio;
    const leak = Math.sin(t / 9.1e6) > 0.997 ? 1100 : 0;
    out.push({
      t,
      co2_in: Math.round(co2In),
      co2_out: Math.round(co2Out),
      reduction: +(((co2In - co2Out) / co2In) * 100).toFixed(2),
      gas_lpm: running ? +(1 + w(t / 1000, 0.03, 700)).toFixed(2) : 0,
      liquid_lpm: running ? 0.4 : 0,
      solvent_c: +(26.5 + w(t / 1000, 1.2, 9000) + (running ? 1.2 : 0)).toFixed(1),
      ph: +Math.max(8.2, 12.4 - 3.6 * cycle).toFixed(2),
      ambient: Math.round(483 + w(t / 1000, 12, 700) + leak),
      exhaust: Math.round(running ? 3600 + w(t / 1000, 60, 900) : 880),
      alarms: leak ? 1 : 0,
      captured_g: running ? +(1 * ((co2In - co2Out) / 1e6) * 1.8 * (stepMs / 60_000)).toFixed(3) : 0,
    });
  }
  return out;
}

/** Convex hourly rollups (mean per hour) to points. */
export function fromRollups(rows: { hour: number; stats: Record<string, { min: number; mean: number; max: number }> }[]): Point[] {
  return rows.map((r) => ({
    t: r.hour,
    co2_in: r.stats.co2_in_ppm?.mean,
    co2_out: r.stats.co2_out_ppm?.mean,
    reduction: r.stats.reduction_pct?.mean,
    gas_lpm: r.stats.gas_lpm?.mean,
    liquid_lpm: r.stats.liquid_lpm?.mean,
    solvent_c: r.stats.solvent_c?.mean,
    ph: r.stats.ph?.mean,
    ambient: r.stats.ambient_mv?.mean,
    exhaust: r.stats.exhaust_mv?.mean,
    captured_g: r.stats.capture_g_min ? r.stats.capture_g_min.mean * 60 : undefined,
  }));
}

/** Aggregate points into buckets (hour, day or month) for History bars and tables. */
export function bucket(points: Point[], key: (t: number) => number): Point[] {
  const m = new Map<number, Point[]>();
  for (const p of points) {
    const k = key(p.t);
    m.set(k, [...(m.get(k) ?? []), p]);
  }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([t, ps]) => {
    const mean = (f: keyof Point) => {
      const v = ps.map((p) => p[f]).filter((x): x is number => typeof x === "number");
      return v.length ? +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(2) : undefined;
    };
    const sum = (f: keyof Point) => +ps.reduce((a, p) => a + ((p[f] as number) ?? 0), 0).toFixed(2);
    return { t, co2_in: mean("co2_in"), co2_out: mean("co2_out"), reduction: mean("reduction"), gas_lpm: mean("gas_lpm"), liquid_lpm: mean("liquid_lpm"), solvent_c: mean("solvent_c"), ph: mean("ph"), ambient: mean("ambient"), exhaust: mean("exhaust"), alarms: sum("alarms"), captured_g: sum("captured_g") };
  });
}
