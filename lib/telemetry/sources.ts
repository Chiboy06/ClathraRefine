import type { Sample, SourceStatus, TelemetrySource } from "./types";
import { TelemetryRow } from "../schema/telemetry";
import { boardCommand, initialBoard, relayOn, stepBoard, type BoardState, type Command } from "../fsm";
import { adcToMv, captureGPerMin, solventCapacityGPerL } from "../process";
import { mvForPpm } from "../mq135";
import { PLANT } from "../demoData";

const TICK_MS = 2000;

type Extra = { co2InMv?: number; co2OutMv?: number; gasLpm?: number; liquidLpm?: number; solventC?: number; ph?: number };

export function toSample(b: BoardState, i: { uptimeMs: number; exhaustMv: number; ambientMv: number; ts: number; thing?: string; buffered?: boolean } & Extra): Sample {
  return {
    thing: i.thing ?? "ESP32S3-N16R8-HARNESS-01",
    ts: i.ts,
    uptime_ms: i.uptimeMs,
    exhaust_mv: i.exhaustMv,
    ambient_mv: i.ambientMv,
    ambient_level: b.level,
    scrubber: b.scrubber,
    relay_mask: b.relayMask,
    trip_latched: b.tripLatched,
    siren_silenced: b.sirenSilenced,
    warming_up: b.warmingUp,
    scram: b.scram,
    sensor_fault: b.sensorFault,
    buffered: !!i.buffered,
    fw: "rev-C (sim)",
    mode: b.mode,
    ...(i.co2InMv !== undefined && { co2_in_mv: i.co2InMv, co2_out_mv: i.co2OutMv }),
    ...(i.gasLpm !== undefined && { gas_lpm: i.gasLpm, liquid_lpm: i.liquidLpm, solvent_c: i.solventC, ph: i.ph }),
    receivedAt: Date.now(),
    check_sensor: i.exhaustMv < 100 || i.ambientMv < 100,
  };
}

/** Deterministic pseudo-noise so the scenario is believable and repeatable. */
const wobble = (t: number, a: number, p: number) => a * Math.sin(t / p) + (a / 3) * Math.sin(t / (p * 0.37));

/**
 * DEMO: runs the firmware port on a generated signal. While the flue gas source is on the exhaust sits above the
 * scrubber threshold, so the skid scrubs CO2; the ambient sits at the 410 ADC baseline until "Trigger leak".
 * The solvent loads as it captures, so breakthrough (outlet/inlet) rises and the solvent forecast has something to fit.
 */
export class ScenarioSource implements TelemetrySource {
  readonly kind = "scenario" as const;
  private timer: ReturnType<typeof setInterval> | null = null;
  private board: BoardState = initialBoard();
  private uptime = 200_000; // past the 180 s warm-up
  private leakAt: number | null = null;
  private pending: { scram?: boolean; ack?: boolean } = {};
  private t = 0;
  gasSource = true;
  private solventL = 2;
  private loadedG = 0.35 * solventCapacityGPerL() * 2; // start part-loaded so saturation is visible within the hour

  get loadingPct() {
    return (this.loadedG / (solventCapacityGPerL() * this.solventL)) * 100;
  }
  setGasSource(on: boolean) {
    this.gasSource = on;
  }
  replaceSolvent() {
    this.loadedG = 0;
  }
  /** Manual command through the board's own interlocks (DEMO). */
  command(c: Command): { accepted: boolean; reason?: string } {
    const r = boardCommand(this.board, c, this.uptime);
    this.board = r.state;
    return { accepted: r.accepted, reason: r.reason };
  }

  triggerLeak() {
    this.leakAt = this.uptime;
  }
  /** Look-ahead of the scripted profile: what the reading will be over the next `seconds`. DEMO only. */
  lookAhead(seconds = 30, step = 2): { t: number; v: number }[] {
    const now = Date.now();
    return Array.from({ length: Math.floor(seconds / step) + 1 }, (_, i) => ({ t: now + i * step * 1000, v: Math.round(this.ambientAt(this.uptime + i * step * 1000, this.t + i)) }));
  }
  get leakActive() {
    return this.leakAt !== null;
  }
  requestScram() {
    this.pending.scram = true;
  }
  /** Simulated press of the physical ACK button (DEMO only). */
  pressAck() {
    this.pending.ack = true;
  }

  /** Scenario ambient profile at a given uptime. Also used as the DEMO look-ahead (Simulated forecast). */
  ambientAt(uptime = this.uptime, t = this.t): number {
    const base = adcToMv(PLANT.ambientAdc) + wobble(t, 12, 7);
    if (this.leakAt === null) return base;
    const s = (uptime - this.leakAt) / 1000;
    if (s < 0) return base;
    // warning, critical trip, auto SCRAM, clear, ACK recovery
    // A slow build-up first, so the forecast crosses the thresholds before the reading does.
    if (s < 16) return base + (1000 - base) * (s / 16);
    if (s < 20) return 1000 + (1650 - 1000) * ((s - 16) / 4);
    if (s < 26) return 1650 + wobble(t, 30, 2);
    if (s < 38) return 2950 + wobble(t, 40, 2);
    if (s < 46) return 1500 - (s - 38) * 100;
    return base;
  }

  private tick() {
    this.uptime += TICK_MS;
    this.t += 1;
    const exhaustMv = Math.round(this.gasSource ? adcToMv(PLANT.inletAdc) + wobble(this.t, 60, 9) : 880 + wobble(this.t, 15, 9));
    const ambientMv = Math.round(this.ambientAt());
    const leakS = this.leakAt === null ? -1 : (this.uptime - this.leakAt) / 1000;
    // The scripted operator presses SCRAM during the critical phase, and ACK twice later (silence, then reset).
    if (leakS >= 30 && leakS < 32) this.pending.scram = true;
    if (leakS >= 34 && leakS < 36) this.pending.ack = true;
    if (leakS >= 50 && leakS < 52) this.pending.ack = true;
    if (leakS >= 56) this.leakAt = null;
    this.board = stepBoard(this.board, { uptimeMs: this.uptime, exhaustMv, ambientMv, scramRequest: this.pending.scram, ackPressed: this.pending.ack });
    this.pending = {};

    // Bench capture: inlet CO2 from the source, outlet from the solvent's breakthrough curve.
    const fan = relayOn(this.board.relayMask, 1);
    const pump = relayOn(this.board.relayMask, 2);
    const inPpm = this.gasSource ? 8000 + wobble(this.t, 250, 23) : 450 + wobble(this.t, 10, 23);
    const load = this.loadingPct / 100;
    const ratio = fan && pump ? 0.08 + 0.92 / (1 + Math.exp(-(load - 0.8) * 10)) : 0.97;
    const outPpm = inPpm * ratio;
    const gasLpm = fan ? 1.0 + wobble(this.t, 0.03, 5) : 0;
    if (fan && pump) this.loadedG = Math.min(solventCapacityGPerL() * this.solventL * 1.6, this.loadedG + captureGPerMin(gasLpm, inPpm, outPpm) * (TICK_MS / 60_000));
    this.emit?.(
      toSample(this.board, {
        uptimeMs: this.uptime,
        exhaustMv,
        ambientMv,
        ts: Date.now(),
        co2InMv: mvForPpm(inPpm),
        co2OutMv: mvForPpm(outPpm),
        gasLpm: +gasLpm.toFixed(2),
        liquidLpm: pump ? +(0.4 + wobble(this.t, 0.01, 7)).toFixed(2) : 0,
        solventC: +(27 + wobble(this.t, 0.4, 41) + (pump ? 1.2 : 0)).toFixed(1),
        ph: +Math.max(8.2, 12.4 - 2.2 * load).toFixed(2),
      }),
    );
  }

  private emit?: (s: Sample) => void;
  start(onSample: (s: Sample) => void, onStatus: (s: SourceStatus) => void) {
    this.emit = onSample;
    onStatus({ connected: true });
    // A few quick steps settle the scrubber into SCRUBBING before the first paint.
    for (let i = 0; i < 3; i++) this.tick();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

/** Plays a recording (fixtures/recordings/*.json, rows as archived in S3) at its own 2 s cadence. */
export class ReplaySource implements TelemetrySource {
  readonly kind = "replay" as const;
  private timer: ReturnType<typeof setInterval> | null = null;
  constructor(private rows: unknown[], private speed = 1) {}
  start(onSample: (s: Sample) => void, onStatus: (s: SourceStatus) => void) {
    const parsed = this.rows.map((r) => TelemetryRow.safeParse(r)).filter((r) => r.success).map((r) => r.data);
    if (!parsed.length) return onStatus({ connected: false, error: "Recording has no valid rows" });
    onStatus({ connected: true });
    let i = 0;
    this.timer = setInterval(() => {
      const r = parsed[i++ % parsed.length];
      onSample({ ...r, receivedAt: Date.now(), check_sensor: r.exhaust_mv < 100 || r.ambient_mv < 100 });
    }, TICK_MS / this.speed);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

/** LIVE: polls /api/telemetry (DynamoDB) every 2 s and emits rows it has not seen. */
export class ApiPollingSource implements TelemetrySource {
  readonly kind = "api" as const;
  private timer: ReturnType<typeof setInterval> | null = null;
  private lastIngest = 0;
  start(onSample: (s: Sample) => void, onStatus: (s: SourceStatus) => void) {
    const load = async () => {
      try {
        const res = await fetch(`/api/telemetry?limit=${this.lastIngest ? 20 : 150}`, { cache: "no-store" });
        if (!res.ok) throw new Error(res.status === 503 ? await res.text() : `HTTP ${res.status}`);
        const rows = (await res.json()) as (Sample & { ingest_ms: number })[];
        for (const r of rows) {
          if ((r.ingest_ms ?? 0) <= this.lastIngest) continue;
          this.lastIngest = r.ingest_ms;
          onSample({ ...r, receivedAt: r.ingest_ms });
        }
        onStatus({ connected: true });
      } catch (e) {
        onStatus({ connected: false, error: (e as Error).message || "Cannot reach the data service" });
      }
    };
    load();
    this.timer = setInterval(load, TICK_MS);
  }
  stop() {
    if (this.timer) clearInterval(this.timer);
  }
}

/** Placeholder for a later WebSocket feed (for example API Gateway WebSocket fed by an IoT rule). */
export class StreamSource implements TelemetrySource {
  readonly kind = "stream" as const;
  start(_s: (s: Sample) => void, onStatus: (s: SourceStatus) => void) {
    onStatus({ connected: false, error: "Stream source not implemented yet" });
  }
  stop() {}
}
