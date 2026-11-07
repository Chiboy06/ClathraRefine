import { describe, expect, it } from "vitest";
import { forecastAndScore, forecastCrossing, riskBand, riskIndex, risePerSecond, sessionAnomalyZ, type Model } from "./predict";

describe("hazard risk index", () => {
  it("is 0 in clean steady air and 100 at the trip", () => {
    expect(riskIndex({ mv: 483, risePerS: 0, anomalyZ: 0, forecastMv: 483 })).toBe(0);
    expect(riskIndex({ mv: 2710, risePerS: 0 })).toBe(100);
  });
  it("rises with the forecast before the reading moves", () => {
    const now = riskIndex({ mv: 900, risePerS: 0, forecastMv: 900 });
    const ahead = riskIndex({ mv: 900, risePerS: 0, forecastMv: 2600 });
    expect(ahead).toBeGreaterThan(now);
    expect(ahead).toBeGreaterThanOrEqual(25);
  });
  it("counts rate of rise and anomaly, and stays within 0 to 100", () => {
    const r = riskIndex({ mv: 2600, risePerS: 200, anomalyZ: 50, forecastMv: 5000 });
    expect(r).toBeLessThanOrEqual(100);
    expect(r).toBeGreaterThan(riskIndex({ mv: 2600, risePerS: 0, anomalyZ: 0, forecastMv: 2600 }));
    expect(riskBand(r)).toBe("High");
    expect(riskBand(10)).toBe("Low");
  });
});

describe("forecast crossing", () => {
  const now = 1_000_000;
  const pts = [0, 10, 20, 30].map((s, i) => ({ t: now + s * 1000, v: [900, 1300, 1500, 2800][i] }));
  it("finds the first future point at or above the threshold", () => {
    expect(forecastCrossing(pts, 1410, now)).toBe(20);
    expect(forecastCrossing(pts, 2710, now)).toBe(30);
  });
  it("is 0 when already over and null when never", () => {
    expect(forecastCrossing(pts, 1410, now, 1500)).toBe(0);
    expect(forecastCrossing(pts, 4000, now)).toBeNull();
  });
  it("ignores points in the past", () => {
    expect(forecastCrossing([{ t: now - 5000, v: 3000 }, ...pts], 2710, now)).toBe(30);
  });
});

describe("leading indicators", () => {
  it("rate of rise over the window", () => {
    const s = Array.from({ length: 11 }, (_, i) => ({ t: i * 1000, v: 500 + i * 20 }));
    expect(risePerSecond(s, 10)).toBeCloseTo(20);
  });
  it("session anomaly needs a clean baseline", () => {
    expect(sessionAnomalyZ([500, 510])).toBeNull();
    const base = Array.from({ length: 30 }, (_, i) => 480 + (i % 5) * 4);
    expect(sessionAnomalyZ([...base, 488])!).toBeLessThan(2);
    expect(sessionAnomalyZ([...base, 1200])!).toBeGreaterThan(10);
  });
});

describe("model scoring (guide 7.5)", () => {
  it("applies standardised coefficients", () => {
    const features = ["now", "lag1", "diff1", "lag2", "diff2", "lag5", "diff5", "lag10", "diff10", "lag15", "diff15", "mean30s", "std30s", "exhaust_now"];
    const m: Model = {
      version: "t",
      forecast: { horizon_s: 30, features, mean: features.map(() => 0), scale: features.map(() => 1), coef: features.map((f) => (f === "now" ? 1 : 0)), intercept: 0, mae_mv: 1, persistence_mae_mv: 2 },
      anomaly: { median_level: 500, mad_level: 10, median_rise: 0, mad_rise: 5, threshold: 6 },
    };
    const amb = Array.from({ length: 20 }, () => 500);
    expect(forecastAndScore(m, amb, 900)).toEqual({ forecast_mv: 500, anomaly: false, z: 0 });
    expect(forecastAndScore(m, amb.slice(0, 10), 900)).toBeNull();
  });
});
