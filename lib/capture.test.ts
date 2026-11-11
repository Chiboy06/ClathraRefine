import { describe, expect, it } from "vitest";
import { deterioration, fitCapture, recommend, type CapturePoint } from "./capture";

// Known plant: removal rises with liquid to gas ratio and absorbent, falls with temperature.
const truth = (lg: number, c: number, abs: number) => 40 + 60 * (lg - 0.4) - 1.5 * (c - 27) + 2 * (abs - 10);
const pt = (i: number, over: Partial<CapturePoint> = {}): CapturePoint => {
  const gasLpm = 1 + 0.2 * Math.sin(i / 7);
  const liquidLpm = 0.4 + 0.1 * Math.sin(i / 11);
  const solventC = 27 + 2 * Math.sin(i / 5);
  const absorbentM = 10 + 3 * Math.cos(i / 13);
  const p = { t: i, inletPpm: 8000 + 100 * Math.sin(i / 3), gasLpm, liquidLpm, lg: liquidLpm / gasLpm, solventC, absorbentM, removal: 0, ...over };
  return { ...p, removal: over.removal ?? truth(p.lg, p.solventC, p.absorbentM) };
};

describe("capture performance", () => {
  const pts = Array.from({ length: 120 }, (_, i) => pt(i));

  it("learns which conditions raise or lower removal", () => {
    const m = fitCapture(pts)!;
    expect(m.r2).toBeGreaterThan(0.95);
    expect(m.influence.lg).toBeGreaterThan(0);
    expect(m.influence.absorbentM).toBeGreaterThan(0);
    expect(m.influence.solventC).toBeLessThan(0);
    expect(fitCapture(pts.slice(0, 10))).toBeNull();
  });

  it("recommends conditions inside the observed range that improve removal", () => {
    const m = fitCapture(pts)!;
    const r = recommend(m, pts)!;
    expect(r.predicted).toBeGreaterThanOrEqual(r.now);
    expect(r.liquidLpm / r.gasLpm).toBeGreaterThanOrEqual(pts.at(-1)!.lg - 1e-9);
    expect(r.gasLpm).toBeLessThanOrEqual(1.2);
  });

  it("flags falling removal and blames the solvent when the absorbent runs down", () => {
    const steady = Array.from({ length: 90 }, (_, i) => pt(i, { gasLpm: 1, liquidLpm: 0.4, lg: 0.4, solventC: 27, absorbentM: 10, removal: 75 + Math.sin(i) }));
    expect(deterioration(steady)!.status).toBe("ok");
    const fading = Array.from({ length: 90 }, (_, i) => pt(i, { gasLpm: 1, liquidLpm: 0.4, lg: 0.4, solventC: 27, inletPpm: 8000, absorbentM: Math.max(1, 12 - i * 0.12), removal: Math.max(5, 80 - i * 0.7) }));
    const d = deterioration(fading)!;
    expect(d.status).toBe("deteriorating");
    expect(d.causes[0].id).toBe("solvent");
  });

  it("blames flow when the solvent flow swings", () => {
    const swinging = Array.from({ length: 90 }, (_, i) => {
      const liquidLpm = i < 60 ? 0.4 : 0.4 + 0.15 * Math.sin(i);
      return pt(i, { gasLpm: 1, liquidLpm, lg: liquidLpm, solventC: 27, inletPpm: 8000, absorbentM: 10, removal: i < 60 ? 75 : 55 });
    });
    expect(deterioration(swinging)!.causes[0].id).toBe("flow");
  });
});
