// Key readings for Overview, the assistant and the AI pages, derived from the hub snapshot. Pure.
import type { Snapshot } from "./telemetry/hub";
import { DEFAULT_CAL, ppmFromMv, type Mq135Cal } from "./mq135";
import { captureGPerMin, reductionPct, solventCapacityGPerL, FW } from "./process";
import { forecastCrossing, riskIndex, risePerSecond, sessionAnomalyZ } from "./predict";
import { sensorHealth, solventForecast, type Health } from "./analytics";
import { relayOn } from "./fsm";

export type Reading = { value: number; unit: string; simulated: boolean };
export type PlantView = {
  at: number | null;
  mode: "LIVE" | "DEMO";
  co2InPpm: Reading;
  co2OutPpm: Reading;
  reductionPct: Reading;
  captureGMin: Reading;
  capturedTodayG: Reading;
  capturedSinceSolventG: Reading;
  gasLpm: Reading;
  liquidLpm: Reading;
  solventC: Reading;
  ph: Reading;
  loadingPct: Reading;
  ambient: { level: string; mv: number };
  exhaustMv: number;
  scrubber: string;
  boardMode: "AUTO" | "MANUAL";
  fanOn: boolean;
  pumpOn: boolean;
  tripped: boolean;
  scram: boolean;
  risk: number;
  warnIn: number | null;
  critIn: number | null;
};

const SOLVENT_L = 2;
const r = (value: number, unit: string, simulated: boolean): Reading => ({ value, unit, simulated });

export function plantView(snap: Snapshot, forecast: { t: number; v: number }[], cal: { in?: Mq135Cal; out?: Mq135Cal } = {}): PlantView {
  const l = snap.latest;
  const demo = snap.mode === "DEMO";
  const inPpm = l?.co2_in_mv !== undefined ? ppmFromMv(l.co2_in_mv, cal.in ?? DEFAULT_CAL) : null;
  const outPpm = l?.co2_out_mv !== undefined ? ppmFromMv(l.co2_out_mv, cal.out ?? DEFAULT_CAL) : null;
  const coSim = demo || inPpm === null || outPpm === null;
  const cIn = inPpm ?? 8000;
  const cOut = outPpm ?? 640;
  const gas = l?.gas_lpm ?? (relayOn(snap.relayMask, 1) ? 1 : 0);
  const capture = captureGPerMin(gas, cIn, cOut);
  // Integrate capture over today's readings (the session's history).
  const midnight = Math.floor((snap.now || Date.now()) / 86_400_000) * 86_400_000;
  let today = 0;
  for (let i = 1; i < snap.history.length; i++) {
    const a = snap.history[i - 1];
    const b = snap.history[i];
    if (b.receivedAt < midnight || a.co2_in_mv === undefined || b.co2_out_mv === undefined) continue;
    const pin = ppmFromMv(b.co2_in_mv!, cal.in ?? DEFAULT_CAL) ?? 0;
    const pout = ppmFromMv(b.co2_out_mv, cal.out ?? DEFAULT_CAL) ?? 0;
    today += captureGPerMin(b.gas_lpm ?? 0, pin, pout) * ((b.receivedAt - a.receivedAt) / 60_000);
  }
  const loading = snap.solventLoadingPct;
  const samples = snap.history.map((h) => ({ t: h.receivedAt, v: h.ambient_mv }));
  const peak = forecast.length ? Math.max(...forecast.map((f) => f.v)) : null;
  return {
    at: l?.receivedAt ?? null,
    mode: snap.mode,
    co2InPpm: r(cIn, "ppm", coSim),
    co2OutPpm: r(cOut, "ppm", coSim),
    reductionPct: r(reductionPct(cIn, cOut), "%", coSim),
    captureGMin: r(capture, "g/min", coSim),
    capturedTodayG: r(today, "g", coSim),
    capturedSinceSolventG: r((loading / 100) * solventCapacityGPerL() * SOLVENT_L, "g", true),
    gasLpm: r(gas, "L/min", demo || l?.gas_lpm === undefined),
    liquidLpm: r(l?.liquid_lpm ?? (relayOn(snap.relayMask, 2) ? 0.4 : 0), "L/min", demo || l?.liquid_lpm === undefined),
    solventC: r(l?.solvent_c ?? 27, "°C", demo || l?.solvent_c === undefined),
    ph: r(l?.ph ?? Math.max(8.2, 12.4 - 2.2 * (loading / 100)), "pH", demo || l?.ph === undefined),
    loadingPct: r(loading, "%", true),
    ambient: { level: l?.ambient_level ?? "NORMAL", mv: l?.ambient_mv ?? 0 },
    exhaustMv: l?.exhaust_mv ?? 0,
    scrubber: l?.scrubber ?? "IDLE",
    boardMode: l?.mode ?? "AUTO",
    fanOn: relayOn(snap.relayMask, 1),
    pumpOn: relayOn(snap.relayMask, 2),
    tripped: !!l?.trip_latched,
    scram: !!l?.scram,
    risk: l ? riskIndex({ mv: l.ambient_mv, risePerS: risePerSecond(samples), anomalyZ: sessionAnomalyZ(samples.map((s) => s.v)), forecastMv: peak }) : 0,
    warnIn: forecastCrossing(forecast, FW.AMB_WARN_ON_MV, snap.now, l?.ambient_mv),
    critIn: forecastCrossing(forecast, FW.AMB_CRIT_ON_MV, snap.now, l?.ambient_mv),
  };
}

/** Breakthrough (outlet/inlet) series from history, for the solvent exhaustion forecast. */
export function breakthroughSeries(snap: Snapshot, cal: { in?: Mq135Cal; out?: Mq135Cal } = {}) {
  const pts: { tMin: number; ratio: number }[] = [];
  const t0 = snap.history[0]?.receivedAt ?? 0;
  for (const h of snap.history.slice(-300)) {
    if (h.co2_in_mv === undefined || h.co2_out_mv === undefined || h.scrubber !== "SCRUBBING") continue;
    const i = ppmFromMv(h.co2_in_mv, cal.in ?? DEFAULT_CAL);
    const o = ppmFromMv(h.co2_out_mv, cal.out ?? DEFAULT_CAL);
    if (i && o !== null && i > 1000) pts.push({ tMin: (h.receivedAt - t0) / 60_000, ratio: o / i });
  }
  return pts;
}

export function solventOutlook(snap: Snapshot, cal: { in?: Mq135Cal; out?: Mq135Cal } = {}) {
  return solventForecast(breakthroughSeries(snap, cal));
}

/** Sensor health for the four gas sensors from this session's clean-air readings. */
export function sensorsHealth(snap: Snapshot, calibrated: { ambient: number; exhaust: number; co2In?: number; co2Out?: number } = { ambient: 483, exhaust: 880 }): { id: string; name: string; health: Health }[] {
  const h = snap.history.slice(-300);
  const stat = (vals: number[]) => {
    if (!vals.length) return { mean: 0, sd: 0 };
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { mean, sd: Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length) };
  };
  const minutes = h.length ? (h[h.length - 1].receivedAt - h[0].receivedAt) / 60_000 : 0;
  const amb = stat(h.filter((x) => x.ambient_level === "NORMAL").map((x) => x.ambient_mv));
  // Exhaust baseline only while the source is off; while gas flows the reading is meant to be high.
  const exh = stat(h.filter((x) => x.scrubber === "IDLE").map((x) => x.exhaust_mv));
  const ci = stat(h.map((x) => x.co2_in_mv ?? 0).filter(Boolean));
  const co = stat(h.map((x) => x.co2_out_mv ?? 0).filter(Boolean));
  return [
    { id: "AT-101", name: "Ambient MQ-2", health: sensorHealth({ name: "AT-101", baselineMv: amb.mean, calibratedMv: calibrated.ambient, stdevMv: amb.sd, minutes }) },
    { id: "AT-102", name: "Exhaust MQ-2", health: sensorHealth({ name: "AT-102", baselineMv: exh.mean || calibrated.exhaust, calibratedMv: calibrated.exhaust, stdevMv: exh.sd, minutes }) },
    { id: "AT-103", name: "Inlet CO2", health: sensorHealth({ name: "AT-103", baselineMv: ci.mean, calibratedMv: calibrated.co2In ?? ci.mean, stdevMv: ci.sd, minutes }) },
    { id: "AT-104", name: "Outlet CO2", health: sensorHealth({ name: "AT-104", baselineMv: co.mean, calibratedMv: calibrated.co2Out ?? co.mean, stdevMv: co.sd, minutes }) },
  ];
}
