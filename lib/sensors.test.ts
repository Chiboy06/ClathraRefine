import { describe, expect, it } from "vitest";
import { calibrateR0, DEFAULT_CAL, mvForPpm, ppmFromMv, rsFromMv, r0FromFreshAir, ppmFromRs } from "./mq135";
import { captureGPerMin, reductionPct, solventLoadingPct } from "./process";
import { anomalyReason, idw, sensorHealth, solventForecast } from "./analytics";
import { ARM_MS, sbo, type Sbo } from "./sbo";
import { boardCommand, initialBoard, stepBoard } from "./fsm";

describe("MQ-135", () => {
  it("Rs from the module output", () => {
    expect(rsFromMv(2500, { rlKohm: 10, vcMv: 5000 })).toBe(10);
    expect(rsFromMv(0)).toBeNull();
    expect(rsFromMv(5000)).toBeNull();
  });
  it("R0 calibrated in fresh air reads 420 ppm back", () => {
    const r0 = r0FromFreshAir(48);
    expect(Math.round(ppmFromRs(48, r0))).toBe(420);
  });
  it("calibrateR0 averages 60 s of readings and needs at least 10", () => {
    const mv = mvForPpm(420, DEFAULT_CAL);
    const r0 = calibrateR0(Array.from({ length: 30 }, () => mv))!;
    expect(r0).toBeCloseTo(DEFAULT_CAL.r0Kohm, 0);
    expect(calibrateR0([mv, mv])).toBeNull();
  });
  it("ppm and mV round-trip, higher CO2 gives higher voltage", () => {
    for (const ppm of [420, 1000, 8000]) expect(Math.abs(ppmFromMv(mvForPpm(ppm))! - ppm) / ppm).toBeLessThan(0.01);
    expect(mvForPpm(8000)).toBeGreaterThan(mvForPpm(420));
  });
});

describe("capture formulas", () => {
  it("reduction, capture rate and solvent loading", () => {
    expect(reductionPct(8000, 640)).toBeCloseTo(92, 5);
    expect(reductionPct(0, 0)).toBe(0);
    // 1 L/min × (8,000 − 640) ppm × 1.8 g/L = 0.013248 g/min
    expect(captureGPerMin(1, 8000, 640)).toBeCloseTo(0.013248, 6);
    expect(captureGPerMin(1, 500, 600)).toBe(0);
    // 0.55 g captured in 2 L of 0.025 M NaOH (1.1 g capacity) = 50%
    expect(solventLoadingPct(0.55, 2)).toBeCloseTo(50, 0);
  });
});

describe("solvent forecast", () => {
  it("fits the breakthrough trend and predicts time to 50%", () => {
    const pts = Array.from({ length: 10 }, (_, i) => ({ tMin: i, ratio: 0.1 + 0.02 * i }));
    const f = solventForecast(pts);
    expect(f.slopePerMin).toBeCloseTo(0.02, 5);
    expect(f.minutes).toBe(11); // at t=9 ratio 0.28, needs 0.22 more
  });
  it("is 0 once saturated and null when not rising", () => {
    expect(solventForecast([0.5, 0.55, 0.6].map((r, i) => ({ tMin: i, ratio: r }))).minutes).toBe(0);
    expect(solventForecast([0.2, 0.2, 0.2].map((r, i) => ({ tMin: i, ratio: r }))).minutes).toBeNull();
    expect(solventForecast([{ tMin: 0, ratio: 0.1 }]).minutes).toBeNull();
  });
});

describe("sensor health rules", () => {
  const base = { name: "AT-101", calibratedMv: 480, stdevMv: 4, minutes: 30 };
  it("OK, drifting and suspect", () => {
    expect(sensorHealth({ ...base, baselineMv: 500 }).status).toBe("OK");
    expect(sensorHealth({ ...base, baselineMv: 650 }).status).toBe("Drifting: calibrate");
    expect(sensorHealth({ ...base, baselineMv: 500, peerBaselineMv: 900 }).status).toBe("Drifting: calibrate");
    expect(sensorHealth({ ...base, baselineMv: 60 }).status).toBe("Suspect: check wiring");
    expect(sensorHealth({ ...base, baselineMv: 500, stdevMv: 0.1 }).status).toBe("Suspect: check wiring");
    expect(sensorHealth({ ...base, baselineMv: 650 }).evidence).toMatch(/\+35%/);
  });
});

describe("heat map interpolation", () => {
  const s = [
    { x: 0, y: 0, v: 100 },
    { x: 10, y: 0, v: 300 },
  ];
  it("returns sample values at sensors and blends between them", () => {
    expect(idw(s, 0, 0)).toBe(100);
    expect(idw(s, 5, 0)).toBeCloseTo(200);
    expect(idw(s, 2, 0)).toBeLessThan(200);
    expect(idw([], 1, 1)).toBe(0);
  });
});

describe("anomaly reason", () => {
  it("names the features that stand out", () => {
    expect(anomalyReason({ risePerS: 40, baselineRisePerS: 1, mv: 1500, normalTop: 1310, hourUtc: 3 })).toMatch(/rising.*above the normal band.*outside normal working hours/);
    expect(anomalyReason({ risePerS: 0.2, baselineRisePerS: 1, mv: 500, normalTop: 1310, hourUtc: 12 })).toBe("Within normal level and rate");
  });
});

describe("select-before-operate", () => {
  it("select, arm, execute, confirm from telemetry", () => {
    let s: Sbo = sbo({ phase: "idle" }, { type: "select", eq: "fan" });
    s = sbo(s, { type: "arm", action: "on", now: 0 });
    expect(s.phase).toBe("armed");
    s = sbo(s, { type: "execute", now: 5000 });
    expect(s.phase).toBe("waiting");
    s = sbo(s, { type: "state", on: false });
    expect(s.phase).toBe("waiting");
    s = sbo(s, { type: "state", on: true });
    expect(s.phase).toBe("confirmed");
  });
  it("arm expires after 10 s and execute is refused", () => {
    let s: Sbo = sbo(sbo({ phase: "idle" }, { type: "select", eq: "pump" }), { type: "arm", action: "on", now: 0 });
    expect(sbo(s, { type: "execute", now: ARM_MS + 1 }).phase).toBe("selected");
    s = sbo(s, { type: "tick", now: ARM_MS + 1 });
    expect(s.phase).toBe("selected");
  });
  it("rejection from the board and confirmation timeout", () => {
    let s: Sbo = sbo(sbo(sbo({ phase: "idle" }, { type: "select", eq: "pump" }), { type: "arm", action: "on", now: 0 }), { type: "execute", now: 1 });
    expect(sbo(s, { type: "ack", accepted: false, reason: "Fan must be on before the pump" })).toMatchObject({ phase: "rejected", reason: "Fan must be on before the pump" });
    s = sbo(s, { type: "tick", now: 20_000 });
    expect(s.phase).toBe("rejected");
  });
  it("execute without arming does nothing", () => {
    const s = sbo({ phase: "idle" }, { type: "select", eq: "fan" });
    expect(sbo(s, { type: "execute", now: 0 })).toBe(s);
  });
});

describe("board interlocks", () => {
  const ready = () => stepBoard(initialBoard(), { uptimeMs: 200_000, exhaustMv: 900, ambientMv: 480 });
  it("manual mode, fan then pump, auto returns on gas", () => {
    let b = ready();
    expect(boardCommand(b, { cmd: "fan", value: "on" }, 1).reason).toBe("Manual mode required");
    const r = boardCommand(b, { cmd: "mode", value: "manual" }, 1);
    expect(r.accepted).toBe(true);
    b = r.state;
    expect(boardCommand(b, { cmd: "pump", value: "on" }, 2).reason).toBe("Fan must be on before the pump");
    b = boardCommand(b, { cmd: "fan", value: "on" }, 2).state;
    b = boardCommand(b, { cmd: "pump", value: "on" }, 3).state;
    b = stepBoard(b, { uptimeMs: 202_000, exhaustMv: 900, ambientMv: 480 });
    expect(b.relayMask & 0b11).toBe(0b11);
    expect(boardCommand(b, { cmd: "fan", value: "off" }, 4).reason).toBe("Stop the pump before the fan");
    b = stepBoard(b, { uptimeMs: 204_000, exhaustMv: 2000, ambientMv: 480 });
    expect(b.mode).toBe("AUTO");
  });
  it("refuses manual when tripped or gas is active, and times out after 10 min", () => {
    const tripped = stepBoard(ready(), { uptimeMs: 202_000, exhaustMv: 900, ambientMv: 2900 });
    expect(boardCommand(tripped, { cmd: "mode", value: "manual" }, 1).reason).toMatch(/Trip latched/);
    const gas = stepBoard(ready(), { uptimeMs: 202_000, exhaustMv: 2000, ambientMv: 480 });
    expect(boardCommand(gas, { cmd: "mode", value: "manual" }, 1).reason).toMatch(/Exhaust gas active/);
    let b = boardCommand(ready(), { cmd: "mode", value: "manual" }, 200_000).state;
    b = stepBoard(b, { uptimeMs: 200_000 + 10 * 60_000 + 1, exhaustMv: 900, ambientMv: 480 });
    expect(b.mode).toBe("AUTO");
  });
});

import { classify, deriveTelemetry, isAwsEnableUrl, keyMatches, IngestTelemetry } from "./ingest";

describe("ingest", () => {
  const row = IngestTelemetry.parse({
    thing: "T1", ts: 1, uptime_ms: 250000, exhaust_mv: 3600, ambient_mv: 480, ambient_level: "NORMAL", scrubber: "SCRUBBING", relay_mask: 11,
    trip_latched: false, siren_silenced: false, warming_up: false, scram: false, sensor_fault: false, buffered: false, fw: "rev-C", co2_in_mv: 1880, co2_out_mv: 980, gas_lpm: 1,
  });
  it("classifies confirmation, ack, event and telemetry", () => {
    expect(classify({ confirmationToken: "x", enableUrl: "https://iot.eu-west-1.amazonaws.com/confirmdestination/abc" })).toBe("confirm");
    expect(classify({ cmd: "ping", accepted: true })).toBe("ack");
    expect(classify({ topic: "clathrarefine/T1/events" })).toBe("event");
    expect(classify({ topic: "clathrarefine/T1/telemetry" })).toBe("telemetry");
  });
  it("only fetches AWS confirmation URLs", () => {
    expect(isAwsEnableUrl("https://iot.eu-west-1.amazonaws.com/confirmdestination/abc")).toBe(true);
    expect(isAwsEnableUrl("https://evil.example.com/confirmdestination/abc")).toBe(false);
  });
  it("checks the key exactly", () => {
    expect(keyMatches("abc", "abc")).toBe(true);
    expect(keyMatches("abd", "abc")).toBe(false);
    expect(keyMatches(null, "abc")).toBe(false);
    expect(keyMatches("abc", undefined)).toBe(false);
  });
  it("derives CO2, reduction, capture and quality", () => {
    const d = deriveTelemetry(row, 1000);
    expect(d.device).toBe("T1");
    expect(d.co2_in_ppm).toBeGreaterThan(d.co2_out_ppm!);
    expect(d.reduction_pct).toBeGreaterThan(85);
    expect(d.capture_g_min).toBeGreaterThan(0);
    expect(d.quality).toBe("Good");
    expect(deriveTelemetry({ ...row, sensor_fault: true }, 1000).quality).toBe("Bad");
  });
});

import { DECISIONS, trainingFrames } from "./training";

describe("training scenario", () => {
  it("each decision point matches the board state it asks about", () => {
    const f = trainingFrames();
    const at = (s: number) => f.find((x) => x.s === s)!;
    expect(at(DECISIONS[0].at).level).toBe("WARNING");
    expect(at(DECISIONS[1].at).trip).toBe(true);
    expect(at(DECISIONS[2].at)).toMatchObject({ level: "NORMAL", trip: true });
    expect(f[f.length - 1].trip).toBe(false);
  });
});
