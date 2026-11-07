// Hazard prediction maths. Advisory only: nothing here can actuate. Tested in predict.test.ts.
import { FW } from "./process";

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export type RiskInput = {
  mv: number; // current ambient reading, sensor mV
  risePerS: number; // mV per second over the last 10 s
  anomalyZ?: number | null; // robust z-score; null when no model or baseline
  forecastMv?: number | null; // 30 s ahead; null when no forecast
};

/**
 * Hazard risk index, 0 to 100. Blends where the reading sits between the top of the normal band and the trip,
 * where the forecast will sit, how fast it is rising and how unusual it is. At or above the trip it is 100.
 */
export function riskIndex(i: RiskInput): number {
  const span = FW.AMB_CRIT_ON_MV - FW.AMB_WARN_OFF_MV;
  if (i.mv >= FW.AMB_CRIT_ON_MV) return 100;
  const pos = clamp01((i.mv - FW.AMB_WARN_OFF_MV) / span);
  const fc = i.forecastMv == null ? pos : clamp01((i.forecastMv - FW.AMB_WARN_OFF_MV) / span);
  const rise = clamp01(i.risePerS / 50);
  const anom = i.anomalyZ == null ? 0 : clamp01((i.anomalyZ - 3) / 7);
  return Math.round(100 * clamp01(0.4 * pos + 0.3 * fc + 0.15 * rise + 0.15 * anom));
}

export const riskBand = (r: number) => (r >= 70 ? "High" : r >= 35 ? "Elevated" : "Low");

/** Seconds from `now` until the forecast first reaches `threshold`; 0 if already there; null if it never does. */
export function forecastCrossing(points: { t: number; v: number }[], threshold: number, now: number, currentMv?: number): number | null {
  if (currentMv !== undefined && currentMv >= threshold) return 0;
  const hit = points.filter((p) => p.t >= now).sort((a, b) => a.t - b.t).find((p) => p.v >= threshold);
  return hit ? Math.max(0, Math.round((hit.t - now) / 1000)) : null;
}

/** Rate of rise in mV per second from evenly or unevenly spaced samples, over the last `windowS` seconds. */
export function risePerSecond(samples: { t: number; v: number }[], windowS = 10): number {
  if (samples.length < 2) return 0;
  const last = samples[samples.length - 1];
  const first = samples.find((s) => last.t - s.t <= windowS * 1000) ?? samples[0];
  const dt = (last.t - first.t) / 1000;
  return dt > 0 ? (last.v - first.v) / dt : 0;
}

/** Robust z-score of the latest value against the session's clean-air samples (below the warning release). */
export function sessionAnomalyZ(values: number[]): number | null {
  const clean = values.filter((v) => v < FW.AMB_WARN_OFF_MV && v >= FW.CHECK_SENSOR_MV);
  if (clean.length < 10 || !values.length) return null;
  const sorted = [...clean].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const dev = clean.map((v) => Math.abs(v - med)).sort((a, b) => a - b);
  const mad = Math.max(dev[Math.floor(dev.length / 2)] * 1.4826, 5);
  return (values[values.length - 1] - med) / mad;
}

export type Model = {
  version: string;
  forecast: { horizon_s: number; features: string[]; mean: number[]; scale: number[]; coef: number[]; intercept: number; mae_mv: number; persistence_mae_mv: number };
  anomaly: { median_level: number; mad_level: number; median_rise: number; mad_rise: number; threshold: number | null };
  report?: { exposures_caught?: number; exposures_total?: number; median_lead_s?: number; false_alarms_per_hour?: number };
};

/** Guide section 7.5: scores the newest evenly spaced 2 s ambient readings with the trained model. */
export function forecastAndScore(m: Model, amb: number[], exhaustNow: number) {
  const n = amb.length - 1;
  if (n < 15) return null;
  const now = amb[n];
  const f: Record<string, number> = { now, exhaust_now: exhaustNow };
  for (const k of [1, 2, 5, 10, 15]) {
    f[`lag${k}`] = amb[n - k];
    f[`diff${k}`] = now - amb[n - k];
  }
  const last15 = amb.slice(n - 14);
  const mean = last15.reduce((a, b) => a + b, 0) / 15;
  f.mean30s = mean;
  f.std30s = Math.sqrt(last15.reduce((a, b) => a + (b - mean) ** 2, 0) / 14);
  const p = m.forecast;
  const forecast = p.features.reduce((acc, name, i) => acc + p.coef[i] * ((f[name] - p.mean[i]) / p.scale[i]), p.intercept);
  const a = m.anomaly;
  const z = Math.max((now - a.median_level) / a.mad_level, (f.diff5 - a.median_rise) / a.mad_rise);
  return { forecast_mv: Math.round(forecast), anomaly: a.threshold !== null && z > a.threshold, z };
}
