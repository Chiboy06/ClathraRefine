// Capture performance: learn how operating conditions drive CO2 removal, recommend better conditions,
// and flag removal that is falling with its likely causes. Pure and advisory: it never actuates.
import type { Sample } from "./telemetry/types";
import { DEFAULT_CAL, ppmFromMv, type Mq135Cal } from "./mq135";
import { reductionPct } from "./process";

export type CapturePoint = { t: number; removal: number; inletPpm: number; gasLpm: number; liquidLpm: number; lg: number; solventC: number; absorbentM: number };

export const FEATURES = [
  { key: "inletPpm", label: "Inlet CO2", unit: "ppm", dp: 0 },
  { key: "gasLpm", label: "Gas flow", unit: "L/min", dp: 2 },
  { key: "lg", label: "Liquid to gas ratio", unit: "", dp: 2 },
  { key: "solventC", label: "Solvent temperature", unit: "°C", dp: 1 },
  { key: "absorbentM", label: "Absorbent concentration", unit: "mM", dp: 1 },
] as const;
export type FeatureKey = (typeof FEATURES)[number]["key"];

/** Free hydroxide from pH, in mM: the working absorbent left in a NaOH solvent. */
export const absorbentFromPh = (ph: number) => 10 ** (ph - 14) * 1000;

/** Scrubbing readings that carry inlet and outlet CO2, both flows, temperature and pH. */
export function capturePoints(history: Sample[], cal: { in?: Mq135Cal; out?: Mq135Cal } = {}): CapturePoint[] {
  const out: CapturePoint[] = [];
  for (const h of history) {
    if (h.scrubber !== "SCRUBBING" || h.co2_in_mv === undefined || h.co2_out_mv === undefined) continue;
    if (!h.gas_lpm || !h.liquid_lpm || h.solvent_c === undefined || h.ph === undefined) continue;
    const i = ppmFromMv(h.co2_in_mv, cal.in ?? DEFAULT_CAL);
    const o = ppmFromMv(h.co2_out_mv, cal.out ?? DEFAULT_CAL);
    if (!i || o === null || i < 1000) continue;
    out.push({ t: h.receivedAt, removal: reductionPct(i, o), inletPpm: i, gasLpm: h.gas_lpm, liquidLpm: h.liquid_lpm, lg: h.liquid_lpm / h.gas_lpm, solventC: h.solvent_c, absorbentM: absorbentFromPh(h.ph) });
  }
  return out;
}

export type CaptureModel = {
  n: number;
  r2: number;
  intercept: number;
  mean: Record<FeatureKey, number>;
  sd: Record<FeatureKey, number>;
  /** Change in removal, in percentage points, for a one standard deviation rise in each input. */
  influence: Record<FeatureKey, number>;
};

const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / (a.length || 1);
const stdev = (a: number[]) => Math.sqrt(avg(a.map((x) => (x - avg(a)) ** 2)));

/** Ridge regression on standardised inputs. Needs 30 points; inputs that never vary get no weight. */
export function fitCapture(pts: CapturePoint[], lambda = 1): CaptureModel | null {
  if (pts.length < 30) return null;
  const keys = FEATURES.map((f) => f.key);
  const mean = Object.fromEntries(keys.map((k) => [k, avg(pts.map((p) => p[k]))])) as Record<FeatureKey, number>;
  const sd = Object.fromEntries(keys.map((k) => [k, stdev(pts.map((p) => p[k]))])) as Record<FeatureKey, number>;
  const live = keys.filter((k) => sd[k] > 1e-9);
  const X = pts.map((p) => live.map((k) => (p[k] - mean[k]) / sd[k]));
  const y = pts.map((p) => p.removal);
  const yMean = avg(y);
  const m = live.length;
  // Normal equations (XᵀX + λI) w = Xᵀ(y - ȳ), solved by Gaussian elimination.
  const A = Array.from({ length: m }, (_, i) => [...Array.from({ length: m }, (_, j) => X.reduce((s, r) => s + r[i] * r[j], 0) + (i === j ? lambda : 0)), X.reduce((s, r, n) => s + r[i] * (y[n] - yMean), 0)]);
  for (let c = 0; c < m; c++) {
    const p = A.reduce((best, r, i) => (i >= c && Math.abs(r[c]) > Math.abs(A[best][c]) ? i : best), c);
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < m; r++) {
      if (r === c || !A[c][c]) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k <= m; k++) A[r][k] -= f * A[c][k];
    }
  }
  const w = Object.fromEntries(keys.map((k) => [k, 0])) as Record<FeatureKey, number>;
  live.forEach((k, i) => (w[k] = A[i][i] ? A[i][m] / A[i][i] : 0));
  const model: CaptureModel = { n: pts.length, r2: 0, intercept: yMean, mean, sd, influence: w };
  const ssTot = y.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const ssRes = pts.reduce((s, p) => s + (p.removal - predictRemoval(model, p)) ** 2, 0);
  model.r2 = ssTot ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return model;
}

export function predictRemoval(m: CaptureModel, p: Partial<CapturePoint> & Pick<CapturePoint, FeatureKey>): number {
  let v = m.intercept;
  for (const f of FEATURES) if (m.sd[f.key] > 1e-9) v += (m.influence[f.key] * (p[f.key] - m.mean[f.key])) / m.sd[f.key];
  return Math.min(100, Math.max(0, v));
}

const pct = (a: number[], q: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))];
};

export type Recommendation = { gasLpm: number; liquidLpm: number; solventC: number; predicted: number; now: number; gain: number; actions: string[] };

/**
 * Best predicted removal over the conditions this plant has actually run at (10th to 90th percentile),
 * holding inlet CO2 and absorbent at their current values. It never extrapolates past what was observed.
 */
export function recommend(m: CaptureModel, pts: CapturePoint[]): Recommendation | null {
  const cur = pts.at(-1);
  if (!cur) return null;
  const range = (k: "gasLpm" | "liquidLpm" | "solventC") => {
    const lo = pct(pts.map((p) => p[k]), 0.1);
    const hi = pct(pts.map((p) => p[k]), 0.9);
    return Array.from({ length: 7 }, (_, i) => lo + ((hi - lo) * i) / 6);
  };
  const now = predictRemoval(m, cur);
  let best = { gasLpm: cur.gasLpm, liquidLpm: cur.liquidLpm, solventC: cur.solventC, predicted: now };
  for (const g of range("gasLpm"))
    for (const l of range("liquidLpm"))
      for (const c of range("solventC")) {
        const v = predictRemoval(m, { ...cur, gasLpm: g, liquidLpm: l, lg: l / g, solventC: c });
        if (v > best.predicted + 0.05) best = { gasLpm: g, liquidLpm: l, solventC: c, predicted: v };
      }
  const actions: string[] = [];
  const step = (label: string, from: number, to: number, unit: string, dp: number) => {
    if (Math.abs(to - from) / (Math.abs(from) || 1) > 0.03) actions.push(`${to > from ? "Raise" : "Lower"} ${label} from ${from.toFixed(dp)} to ${to.toFixed(dp)} ${unit}`);
  };
  step("gas flow", cur.gasLpm, best.gasLpm, "L/min", 2);
  step("solvent flow", cur.liquidLpm, best.liquidLpm, "L/min", 2);
  step("solvent temperature", cur.solventC, best.solventC, "°C", 1);
  if (m.influence.absorbentM > 0.5 && cur.absorbentM < pct(pts.map((p) => p.absorbentM), 0.5)) actions.push("Top up or replace the solvent: removal rises with absorbent concentration");
  return { ...best, now, gain: best.predicted - now, actions };
}

export type Cause = { id: "solvent" | "flow" | "conditions" | "sensor"; title: string; score: number; evidence: string };
export type Deterioration = { status: "ok" | "watch" | "deteriorating"; reference: number; recent: number; drop: number; causes: Cause[] };

/** Compare recent removal with the start of the window and rank the likely causes of any fall. */
export function deterioration(pts: CapturePoint[], recentN = 15): Deterioration | null {
  if (pts.length < recentN * 3) return null;
  const ref = pts.slice(0, Math.floor(pts.length / 3));
  const rec = pts.slice(-recentN);
  const f = (a: CapturePoint[], k: keyof CapturePoint) => avg(a.map((p) => p[k]));
  const reference = f(ref, "removal");
  const recent = f(rec, "removal");
  const drop = reference - recent;
  const status = drop >= 15 ? "deteriorating" : drop >= 5 ? "watch" : "ok";
  const causes: Cause[] = [];
  if (status !== "ok") {
    const absFall = 1 - f(rec, "absorbentM") / (f(ref, "absorbentM") || 1);
    if (absFall > 0.3) causes.push({ id: "solvent", title: "Solvent degradation", score: Math.min(1, absFall), evidence: `Absorbent concentration fell ${Math.round(absFall * 100)}% (pH-based estimate)` });
    const cv = (k: "gasLpm" | "liquidLpm") => stdev(rec.map((p) => p[k])) / (f(rec, k) || 1);
    const lgFall = 1 - f(rec, "lg") / (f(ref, "lg") || 1);
    const flowScore = Math.max(cv("gasLpm") / 0.1, cv("liquidLpm") / 0.1, lgFall / 0.15) / 2;
    if (flowScore > 0.5)
      causes.push({ id: "flow", title: "Flow variation", score: Math.min(1, flowScore), evidence: `Gas flow varies ${Math.round(cv("gasLpm") * 100)}%, solvent flow ${Math.round(cv("liquidLpm") * 100)}%; liquid to gas ratio ${lgFall > 0 ? "down" : "up"} ${Math.abs(Math.round(lgFall * 100))}%` });
    const tempRise = f(rec, "solventC") - f(ref, "solventC");
    const inletShift = f(rec, "inletPpm") / (f(ref, "inletPpm") || 1) - 1;
    const odd = Math.max(tempRise / 3, Math.abs(inletShift) / 0.25, f(rec, "solventC") > 40 ? 1 : 0);
    if (odd > 0.5) causes.push({ id: "conditions", title: "Abnormal operating conditions", score: Math.min(1, odd / 2 + 0.25), evidence: `Solvent temperature ${tempRise >= 0 ? "+" : ""}${tempRise.toFixed(1)} °C; inlet CO2 ${inletShift >= 0 ? "+" : ""}${Math.round(inletShift * 100)}%` });
    if (!causes.length) causes.push({ id: "sensor", title: "Unexplained: check CO2 sensors", score: 0.4, evidence: "Solvent, flows and conditions look steady. Recalibrate the inlet and outlet CO2 sensors." });
    causes.sort((a, b) => b.score - a.score);
  }
  return { status, reference, recent, drop, causes };
}
