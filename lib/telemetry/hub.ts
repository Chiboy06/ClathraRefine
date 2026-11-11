"use client";
// One client-side hub: picks the source for the data mode, keeps history, derives alarms, events and relay history.
import type { Sample, SourceStatus, TelemetrySource } from "./types";
import { ApiPollingSource, ScenarioSource } from "./sources";
import { alarmReduce, newAlarm, type Alarm, type Priority } from "../alarms";
import { FW, captureRateKgH, DEMO_CAPTURE, removalEfficiency } from "../process";
import { PLANT } from "../demoData";
import { relayOn } from "../fsm";
import { STALE_MS } from "../quality";
import { riskIndex, risePerSecond, sessionAnomalyZ } from "../predict";
import type { Command } from "../fsm";
import { convex } from "../convexClient";
import { ConvexSource } from "./convexSource";

export type Severity = "INFO" | "WARNING" | "CRITICAL" | "PASS" | "AUDIT";
export type HubEvent = { id: string; at: number; severity: Severity; source: "board" | "app" | "demo"; tag: string; message: string };
export type RelayChange = { at: number; on: boolean; cause: string };
export type Incident = { id: string; at: number; tag: string; location: string; peak: number; ackStatus: string; action: string; priority: Priority };

export type Plant = {
  inletPct: number;
  outletPct: number;
  efficiency: number;
  flowM3h: number;
  dpKpa: number;
  leanPh: number;
  richPh: number;
  tempC: number;
  captureKgH: number;
  loadingPct: number;
  safetyScore: number;
  flueGasPpm: number;
  flueGasAdc: number;
  dailyCo2t: number;
  pressurePa: number;
};

export type Snapshot = {
  mode: "LIVE" | "DEMO";
  latest: Sample | null;
  history: Sample[];
  status: SourceStatus;
  link: { connected: boolean; perMinute: number; lastAt: number | null };
  alarms: Alarm[];
  activations: Record<string, number[]>;
  incidents: Incident[];
  events: HubEvent[];
  relayHistory: RelayChange[][];
  relayMask: number;
  plant: Plant;
  leakActive: boolean;
  riskHistory: { t: number; risk: number }[];
  acks: Ack[];
  gasSource: boolean;
  solventLoadingPct: number;
  now: number;
};

export type Ack = { cmd: string; value?: string; accepted: boolean; reason?: string; at: number };

const ALARM_DEFS: { id: string; tag: string; priority: Priority; message: string; location: string }[] = [
  { id: "ALM-AT101-HIHI", tag: "AT-101", priority: "critical", message: "Ambient gas critical: trip latched", location: "Ambient sensor (GPIO 2)" },
  { id: "ALM-AT101-HI", tag: "AT-101", priority: "high", message: "Ambient gas pre-hazard warning", location: "Ambient sensor (GPIO 2)" },
  { id: "ALM-HS001", tag: "HS-001", priority: "critical", message: "Master SCRAM latched", location: "Edge controller" },
  { id: "ALM-TRIP", tag: "XA-206", priority: "high", message: "Trip latched: reset with the physical ACK button", location: "Edge controller" },
  { id: "ALM-SENSOR", tag: "AT-101", priority: "high", message: "Check sensor: reading below 100 mV or sensor fault", location: "MQ-2 harness" },
  { id: "ALM-STALE", tag: "HS-001", priority: "medium", message: "No reading for over 10 s", location: "AWS link" },
];

/** Plant-scale values with no sensor. Always DEMO / Simulated, in both data modes. */
export function plantAt(ms: number, scrubbing: boolean): Plant {
  const t = ms / 1000;
  const w = (a: number, p: number) => a * Math.sin(t / p);
  const inletPct = PLANT.inletPct + w(0.04, 47);
  const outletPct = scrubbing ? PLANT.outletPct + w(0.02, 31) : inletPct * 0.97;
  const flowM3h = PLANT.flowM3h + w(4, 53);
  const tempC = PLANT.tempC + w(0.3, 61);
  const capture = captureRateKgH({ ...DEMO_CAPTURE, flowM3h, tempK: tempC + 273.15, yIn: inletPct / 100, yOut: outletPct / 100 });
  return {
    inletPct,
    outletPct,
    efficiency: removalEfficiency(inletPct, outletPct),
    flowM3h,
    dpKpa: PLANT.dpKpa + w(0.03, 41),
    leanPh: PLANT.leanPh,
    richPh: PLANT.richPh + w(0.05, 73),
    tempC,
    captureKgH: capture,
    loadingPct: 54 + ((t / 60) % 30),
    safetyScore: PLANT.safetyScore,
    flueGasPpm: PLANT.flueGasPpm + Math.round(w(6, 11)),
    flueGasAdc: PLANT.flueGasAdc + Math.round(w(14, 11)),
    dailyCo2t: PLANT.dailyCo2t,
    pressurePa: DEMO_CAPTURE.pressurePa,
  };
}

const MAX_HISTORY = 3600; // 2 h at 2 s
const uid = () => Math.random().toString(36).slice(2, 10);

function seedEvents(now: number): HubEvent[] {
  const h = 3_600_000;
  return [
    { id: uid(), at: now - 6 * h, severity: "INFO", source: "demo", tag: "HS-001", message: "Controller power-on, MQ-2 warm-up started (180 s)" },
    { id: uid(), at: now - 6 * h + 181_000, severity: "PASS", source: "demo", tag: "AT-101", message: "Warm-up complete, ambient baseline 483 mV" },
    { id: uid(), at: now - 5.5 * h, severity: "INFO", source: "demo", tag: "P-202", message: "Scrubber INTAKE_ACTIVE, pump start after 2.0 s stagger" },
    { id: uid(), at: now - 4 * h, severity: "AUDIT", source: "demo", tag: "AUD-2026-0891", message: "Audit AUD-2026-0891 opened by Dr. Amina Bello" },
    { id: uid(), at: now - 3.2 * h, severity: "WARNING", source: "demo", tag: "PDT-302", message: "Column ΔP 2.6 kPa approached high limit, returned to normal" },
    { id: uid(), at: now - 2 * h, severity: "PASS", source: "demo", tag: "HS-001", message: "Hardware loop diagnostic passed (4 of 4)" },
    { id: uid(), at: now - 1 * h, severity: "INFO", source: "demo", tag: "LT-401", message: "Solvent top-up recorded, lean pH 12.4" },
  ].sort((a, b) => b.at - a.at) as HubEvent[];
}

function seedIncidents(now: number): Incident[] {
  const h = 3_600_000;
  return [
    { id: "INC-DEMO-05", at: now - 3.2 * h, tag: "PDT-302", location: "Packed column", peak: 2.6, ackStatus: "Acknowledged by Engr. T. Balogun", action: "Demo history: returned to normal", priority: "medium" as const },
    { id: "INC-DEMO-04", at: now - 26 * h, tag: "AT-101", location: "Ambient sensor (GPIO 2)", peak: 1520, ackStatus: "Acknowledged by Ngozi Eze", action: "Demo history: flange re-torqued", priority: "high" as const },
    { id: "INC-DEMO-03", at: now - 49 * h, tag: "AT-101", location: "Ambient sensor (GPIO 2)", peak: 2840, ackStatus: "Acknowledged by Ibrahim Musa", action: "Demo history: trip latched, ACK reset", priority: "critical" as const },
    { id: "INC-DEMO-02", at: now - 73 * h, tag: "AT-102", location: "Exhaust sensor (GPIO 1)", peak: 64, ackStatus: "Acknowledged by Engr. T. Balogun", action: "Demo history: check sensor, harness reseated", priority: "high" as const },
    { id: "INC-DEMO-01", at: now - 97 * h, tag: "HS-001", location: "AWS link", peak: 0, ackStatus: "Returned unacknowledged", action: "Demo history: venue Wi-Fi blocked 8883", priority: "medium" as const },
  ];
}

class Hub {
  private listeners = new Set<() => void>();
  private source: TelemetrySource | null = null;
  readonly scenario = new ScenarioSource();
  private msgTimes: number[] = [];
  private alarmsMap = new Map<string, Alarm>(ALARM_DEFS.map((d) => [d.id, newAlarm(d.id, d.tag, d.priority, d.message)]));
  private ticker: ReturnType<typeof setInterval> | null = null;
  snap: Snapshot;

  constructor() {
    const now = Date.now();
    this.snap = {
      mode: "DEMO",
      latest: null,
      history: [],
      status: { connected: false },
      link: { connected: false, perMinute: 0, lastAt: null },
      alarms: [...this.alarmsMap.values()],
      activations: {},
      incidents: seedIncidents(now),
      events: seedEvents(now),
      relayHistory: Array.from({ length: 6 }, () => []),
      relayMask: 0,
      plant: plantAt(now, true),
      leakActive: false,
      riskHistory: [],
      acks: [],
      gasSource: true,
      solventLoadingPct: 0,
      now,
    };
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    if (!this.source) this.setMode(this.snap.mode);
    return () => {
      this.listeners.delete(fn);
    };
  };
  getSnapshot = () => this.snap;
  private set(patch: Partial<Snapshot>) {
    this.snap = { ...this.snap, ...patch };
    this.listeners.forEach((l) => l());
  }

  setMode(mode: "LIVE" | "DEMO") {
    if (this.source && this.snap.mode === mode) return;
    this.source?.stop();
    this.msgTimes = [];
    this.set({ mode, latest: null, history: [], status: { connected: false } });
    // LIVE: Convex pushes readings when a deployment is configured; otherwise poll the API.
    const source = mode === "DEMO" ? this.scenario : convex ? new ConvexSource((ack) => this.addAck(ack)) : new ApiPollingSource();
    this.source = source;
    // A stopped source can still finish an in-flight request; ignore it so its error never shows on the new mode.
    source.start(
      (s) => this.source === source && this.ingest(s),
      (status) => this.source === source && this.set({ status }),
    );
    if (!this.ticker) this.ticker = setInterval(this.tick, 1000);
  }

  private tick = () => {
    const now = Date.now();
    this.msgTimes = this.msgTimes.filter((t) => now - t < 60_000);
    const last = this.snap.latest;
    const stale = !last || now - last.receivedAt > STALE_MS;
    this.updateAlarm("ALM-STALE", stale && !!last, 0, now, false);
    for (const a of this.alarmsMap.values()) this.alarmsMap.set(a.id, alarmReduce(a, { type: "tick", now, suppressed: !!last?.warming_up }));
    this.set({
      now,
      relayMask: last?.relay_mask ?? 0,
      alarms: [...this.alarmsMap.values()],
      link: { connected: this.snap.status.connected && !stale, perMinute: this.msgTimes.length, lastAt: last?.receivedAt ?? null },
      plant: plantAt(now, !last || last.scrubber === "SCRUBBING" || this.snap.mode === "LIVE"),
      leakActive: this.scenario.leakActive,
      riskHistory: last ? [...this.snap.riskHistory, { t: now, risk: this.riskNow() }].slice(-120) : this.snap.riskHistory,
      gasSource: this.scenario.gasSource,
      solventLoadingPct: this.scenario.loadingPct,
    });
  };


  private updateAlarm(id: string, active: boolean, value: number, now: number, suppressed: boolean) {
    const prev = this.alarmsMap.get(id)!;
    const next = alarmReduce(prev, { type: "condition", active, value, now, suppressed });
    this.alarmsMap.set(id, next);
    if (active && !prev.active) {
      const def = ALARM_DEFS.find((d) => d.id === id)!;
      const acts = { ...this.snap.activations, [id]: [...(this.snap.activations[id] ?? []), now].slice(-50) };
      this.snap = { ...this.snap, activations: acts };
      this.pushIncident({ id: `INC-${now.toString(36).toUpperCase()}`, at: now, tag: def.tag, location: def.location, peak: value, ackStatus: "Unacknowledged", action: "Auto: firmware interlock", priority: def.priority });
    }
    if (active && prev.active && value > prev.peak) {
      const inc = this.snap.incidents.find((i) => i.tag === prev.tag && i.at >= prev.since);
      if (inc) inc.peak = value;
    }
  }

  private pushIncident(i: Incident) {
    this.snap = { ...this.snap, incidents: [i, ...this.snap.incidents].slice(0, 500) };
  }

  addEvent(e: Omit<HubEvent, "id" | "at"> & { at?: number }) {
    this.set({ events: [{ id: uid(), at: e.at ?? Date.now(), ...e }, ...this.snap.events].slice(0, 1000) });
  }

  private ingest = (s: Sample) => {
    const now = Date.now();
    this.msgTimes.push(now);
    const prev = this.snap.latest;
    const history = [...this.snap.history, s].slice(-MAX_HISTORY);
    const src = this.snap.mode === "DEMO" ? "demo" : "board";

    // Events on change, same rule as the firmware's events topic
    const ev: Omit<HubEvent, "id">[] = [];
    if (prev) {
      if (s.ambient_level !== prev.ambient_level)
        ev.push({ at: now, severity: s.ambient_level === "CRITICAL" ? "CRITICAL" : s.ambient_level === "WARNING" ? "WARNING" : "PASS", source: src, tag: "AT-101", message: `Ambient level ${prev.ambient_level} to ${s.ambient_level} (${s.ambient_mv} mV)` });
      if (s.scrubber !== prev.scrubber) ev.push({ at: now, severity: "INFO", source: src, tag: "P-202", message: `Scrubber ${prev.scrubber} to ${s.scrubber}` });
      if (s.trip_latched !== prev.trip_latched) ev.push({ at: now, severity: s.trip_latched ? "CRITICAL" : "PASS", source: src, tag: "XA-206", message: s.trip_latched ? "Trip latched" : "Trip reset at the board (physical ACK)" });
      if (s.scram !== prev.scram) ev.push({ at: now, severity: s.scram ? "CRITICAL" : "PASS", source: src, tag: "HS-001", message: s.scram ? "SCRAM confirmed by board telemetry" : "SCRAM cleared at the board" });
      if (s.siren_silenced && !prev.siren_silenced) ev.push({ at: now, severity: "INFO", source: src, tag: "XA-206", message: "Siren silenced (first physical ACK press)" });
      if (!s.warming_up && prev.warming_up) ev.push({ at: now, severity: "PASS", source: src, tag: "AT-101", message: "Warm-up complete" });
      if (s.sensor_fault !== prev.sensor_fault) ev.push({ at: now, severity: s.sensor_fault ? "CRITICAL" : "PASS", source: src, tag: "AT-101", message: s.sensor_fault ? "Sensor fault" : "Sensor fault cleared" });
    }
    const relayHistory = this.snap.relayHistory.map((h, i) => {
      const was = prev ? relayOn(prev.relay_mask, i + 1) : null;
      const is = relayOn(s.relay_mask, i + 1);
      return was === null || was === is ? h : [{ at: now, on: is, cause: `Edge FSM (${s.scrubber}, ${s.ambient_level})` }, ...h].slice(0, 10);
    });

    const supp = s.warming_up;
    this.updateAlarm("ALM-AT101-HIHI", s.ambient_level === "CRITICAL", s.ambient_mv, now, supp);
    this.updateAlarm("ALM-AT101-HI", s.ambient_level !== "NORMAL", s.ambient_mv, now, supp);
    this.updateAlarm("ALM-HS001", s.scram, s.ambient_mv, now, false);
    this.updateAlarm("ALM-TRIP", s.trip_latched, s.ambient_mv, now, false);
    this.updateAlarm("ALM-SENSOR", s.sensor_fault || s.exhaust_mv < FW.CHECK_SENSOR_MV || s.ambient_mv < FW.CHECK_SENSOR_MV, Math.min(s.exhaust_mv, s.ambient_mv), now, false);
    this.updateAlarm("ALM-STALE", false, 0, now, false);

    this.set({
      latest: s,
      history,
      relayHistory,
      relayMask: s.relay_mask,
      alarms: [...this.alarmsMap.values()],
      events: ev.length ? [...ev.map((e) => ({ ...e, id: uid() })).reverse(), ...this.snap.events].slice(0, 1000) : this.snap.events,
    });
  };

  // ---- actions ----
  ack(alarmId: string, by: string) {
    const a = this.alarmsMap.get(alarmId);
    if (!a) return;
    this.alarmsMap.set(alarmId, alarmReduce(a, { type: "ack", by }));
    this.snap = { ...this.snap, incidents: this.snap.incidents.map((i) => (i.tag === a.tag && i.at >= a.since ? { ...i, ackStatus: `Acknowledged (software) by ${by}` } : i)) };
    this.set({ alarms: [...this.alarmsMap.values()] });
  }
  shelve(alarmId: string, reason: string, until: number) {
    const a = this.alarmsMap.get(alarmId);
    if (!a) return;
    this.alarmsMap.set(alarmId, alarmReduce(a, { type: "shelve", reason, until }));
    this.set({ alarms: [...this.alarmsMap.values()] });
  }
  /** Risk index from the reading, rate of rise, session anomaly and (DEMO) the look-ahead peak. */
  riskNow() {
    const l = this.snap.latest;
    if (!l) return 0;
    const samples = this.snap.history.slice(-60).map((h) => ({ t: h.receivedAt, v: h.ambient_mv }));
    const fc = this.demoForecast(30);
    return riskIndex({ mv: l.ambient_mv, risePerS: risePerSecond(samples), anomalyZ: sessionAnomalyZ(this.snap.history.map((h) => h.ambient_mv)), forecastMv: fc.length ? Math.max(...fc.map((f) => f.v)) : null });
  }
  /** DEMO look-ahead from the scenario (Simulated). LIVE forecasts come from lib/model.json via the predict page. */
  demoForecast(seconds = 30) {
    return this.snap.mode === "DEMO" ? this.scenario.lookAhead(seconds) : [];
  }
  /** DEMO: the scenario board applies its own interlocks and answers like cmd/ack, a moment later. */
  commandDemo(c: Command) {
    const r = this.scenario.command(c);
    setTimeout(() => this.addAck({ cmd: c.cmd, value: c.value, accepted: r.accepted, reason: r.reason, at: Date.now() }), 300);
  }
  /** LIVE acks arrive from Convex (cmd/ack through the ingest rule). */
  addAck(a: Ack) {
    this.set({ acks: [a, ...this.snap.acks].slice(0, 50) });
    this.addEvent({ severity: a.accepted ? "INFO" : "WARNING", source: this.snap.mode === "DEMO" ? "demo" : "board", tag: a.cmd === "fan" ? "XV-201" : a.cmd === "pump" ? "P-202" : "HS-001", message: a.accepted ? `Board accepted ${a.cmd} ${a.value ?? ""}`.trim() : `Board rejected ${a.cmd} ${a.value ?? ""}: ${a.reason}` });
  }
  setGasSource(on: boolean) {
    this.scenario.setGasSource(on);
    this.set({ gasSource: on });
  }
  replaceSolvent() {
    this.scenario.replaceSolvent();
    this.addEvent({ severity: "PASS", source: "demo", tag: "LT-401", message: "Solvent replaced (Demo)" });
  }
  triggerLeak() {
    if (this.snap.mode !== "DEMO") return;
    this.scenario.triggerLeak();
    this.addEvent({ severity: "WARNING", source: "demo", tag: "AT-101", message: "Trigger leak: hazard sequence started (Demo)" });
  }
  scramDemo() {
    this.scenario.requestScram();
  }
  pressAckDemo() {
    this.scenario.pressAck();
    this.addEvent({ severity: "INFO", source: "demo", tag: "HS-001", message: "Physical ACK button pressed (simulated)" });
  }
  /** DEMO only: an approved safety bypass acts on the scenario board until it expires. */
  applyOverride(kind: string, _target: string, minutes: number) {
    this.scenario.bypass(kind, minutes);
    this.addEvent({ severity: "AUDIT", source: "demo", tag: kind === "siren_mute" ? "XA-206" : "HS-001", message: `Safety bypass ${kind.replace("_", " ")} approved for ${minutes} min (Demo)` });
  }
}

let hub: Hub | null = null;
export function getHub() {
  hub ??= new Hub();
  return hub;
}


/** Server and hydration snapshot: no data, so pages render skeletons until the client hub is live. */
export const EMPTY_SNAP: Snapshot = {
  mode: "DEMO",
  latest: null,
  history: [],
  status: { connected: false },
  link: { connected: false, perMinute: 0, lastAt: null },
  alarms: [],
  activations: {},
  incidents: [],
  events: [],
  relayHistory: Array.from({ length: 6 }, () => []),
  relayMask: 0,
  plant: plantAt(0, true),
  leakActive: false,
  riskHistory: [],
  acks: [],
  gasSource: true,
  solventLoadingPct: 0,
  now: 0,
};
