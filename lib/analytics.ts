// Advisory analytics: solvent exhaustion, sensor health, gas heat map, anomaly reasons. Tested in sensors.test.ts.
import { FW } from "./process";

/** Least-squares fit of breakthrough ratio (outlet/inlet) over time; minutes until it reaches `target`. */
export function solventForecast(points: { tMin: number; ratio: number }[], target = 0.5): { minutes: number | null; slopePerMin: number; now: number } {
  const n = points.length;
  if (n < 3) return { minutes: null, slopePerMin: 0, now: points[n - 1]?.ratio ?? 0 };
  const mx = points.reduce((s, p) => s + p.tMin, 0) / n;
  const my = points.reduce((s, p) => s + p.ratio, 0) / n;
  const sxx = points.reduce((s, p) => s + (p.tMin - mx) ** 2, 0);
  const slope = sxx ? points.reduce((s, p) => s + (p.tMin - mx) * (p.ratio - my), 0) / sxx : 0;
  const last = points[n - 1];
  const nowFit = my + slope * (last.tMin - mx);
  if (nowFit >= target) return { minutes: 0, slopePerMin: slope, now: nowFit };
  if (slope <= 0) return { minutes: null, slopePerMin: slope, now: nowFit };
  return { minutes: Math.round((target - nowFit) / slope), slopePerMin: slope, now: nowFit };
}

export type Health = { status: "OK" | "Drifting: calibrate" | "Suspect: check wiring"; evidence: string };

/**
 * Sensor health from its clean-air baseline over days and against its peer.
 * Suspect: reading below 100 mV, or flat (no variation) for 10 minutes. Drifting: baseline moved over 25% from calibration,
 * or the two MQ-2s disagree in clean air by over 40%.
 */
export function sensorHealth(i: { name: string; baselineMv: number; calibratedMv: number; peerBaselineMv?: number; stdevMv: number; minutes: number }): Health {
  if (i.baselineMv < FW.CHECK_SENSOR_MV) return { status: "Suspect: check wiring", evidence: `${i.name} reads ${Math.round(i.baselineMv)} mV, below 100 mV` };
  if (i.minutes >= 10 && i.stdevMv < 0.5) return { status: "Suspect: check wiring", evidence: `${i.name} has not changed for ${i.minutes} min` };
  const drift = (i.baselineMv - i.calibratedMv) / i.calibratedMv;
  if (Math.abs(drift) > 0.25) return { status: "Drifting: calibrate", evidence: `Clean-air baseline ${Math.round(i.baselineMv)} mV vs ${Math.round(i.calibratedMv)} mV at calibration (${drift > 0 ? "+" : ""}${Math.round(drift * 100)}%)` };
  if (i.peerBaselineMv !== undefined) {
    const peer = Math.abs(i.baselineMv - i.peerBaselineMv) / Math.min(i.baselineMv, i.peerBaselineMv);
    if (peer > 0.4) return { status: "Drifting: calibrate", evidence: `Clean-air baseline differs from its peer by ${Math.round(peer * 100)}%` };
  }
  return { status: "OK", evidence: `Baseline ${Math.round(i.baselineMv)} mV, within 25% of calibration` };
}

/** Inverse-distance weighting. Indicative only: improves with more sensors. */
export function idw(samples: { x: number; y: number; v: number }[], x: number, y: number, power = 2): number {
  let num = 0;
  let den = 0;
  for (const s of samples) {
    const d2 = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d2 === 0) return s.v;
    const w = 1 / Math.pow(d2, power / 2);
    num += w * s.v;
    den += w;
  }
  return den ? num / den : 0;
}

/** One-line reason for an anomaly score, built from its features. */
export function anomalyReason(i: { risePerS: number; baselineRisePerS: number; mv: number; normalTop: number; hourUtc: number }): string {
  const parts: string[] = [];
  if (i.risePerS > Math.max(5, i.baselineRisePerS * 5)) parts.push(`rising ${i.risePerS.toFixed(1)} mV/s, ${Math.round(i.risePerS / Math.max(0.5, i.baselineRisePerS))}× the usual rate`);
  if (i.mv > i.normalTop) parts.push(`${Math.round(i.mv)} mV is above the normal band (${i.normalTop} mV)`);
  if (i.hourUtc < 5 || i.hourUtc >= 22) parts.push("outside normal working hours");
  return parts.length ? parts.join("; ") : "Within normal level and rate";
}
