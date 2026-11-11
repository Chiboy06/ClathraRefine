// Ingest logic shared by the Convex /ingest HTTP action and its tests. Pure: no I/O.
import { z } from "zod";
import { TelemetryRow } from "./schema/telemetry";
import { DEFAULT_CAL, ppmFromMv, type Mq135Cal } from "./mq135";
import { captureGPerMin, reductionPct } from "./process";
import { quality } from "./quality";

export const IngestTelemetry = TelemetryRow.extend({ device: z.string().min(1).max(128).optional() });

export const IngestAck = z.object({
  thing: z.string().optional(),
  device: z.string().optional(),
  cmd: z.string().max(16),
  accepted: z.boolean(),
  reason: z.string().max(120).optional(),
});

export type Kind = "telemetry" | "event" | "ack" | "confirm";

/** AWS sends a confirmation body first; acks carry `cmd`; the rule tags the topic so events and telemetry split. */
export function classify(body: Record<string, unknown>): Kind {
  if (typeof body.confirmationToken === "string" && typeof body.enableUrl === "string") return "confirm";
  if (typeof body.cmd === "string") return "ack";
  if (typeof body.topic === "string" && body.topic.endsWith("/events")) return "event";
  return "telemetry";
}

/**
 * Firmware rev D.x publishes its own field names and relay order. Map them onto the rev C contract the app reads,
 * so both revisions land in the same table. Rev C bodies pass through unchanged.
 * D.x relay bits: 0 fan, 1 pump 1, 2 pump 2, 3 red, 4 green, 5 siren. App bits: 0 fan, 1 pump, 2 red, 3 green, 4 yellow, 5 siren.
 * D.x has one MQ-135 on GPIO5, the rev C outlet pin, so it is read as outlet CO2.
 */
export function fromBoard(body: Record<string, unknown>): Record<string, unknown> {
  if (body.exhaust_mv !== undefined || body.feed_influx_mv === undefined) return body;
  const r = Number(body.relays ?? 0);
  const bit = (n: number) => (r >> n) & 1;
  return {
    ...body,
    exhaust_mv: body.feed_influx_mv,
    ambient_mv: body.amb_leak_mv,
    ...(body.solvent_mv !== undefined && { co2_out_mv: body.solvent_mv }),
    relay_mask: bit(0) | ((bit(1) | bit(2)) << 1) | (bit(3) << 2) | (bit(4) << 3) | (bit(5) << 5),
    trip_latched: body.trip === true || body.lockout === true,
    siren_silenced: body.silenced === true,
    warming_up: body.warmup === true,
    sensor_fault: body.fault === true,
    buffered: body.buffered === true,
  };
}

/** Only fetch AWS's own confirmation URL, never an arbitrary host. */
export const isAwsEnableUrl = (url: string) => /^https:\/\/iot\.[a-z0-9-]+\.amazonaws\.com\/confirmdestination\//.test(url);

/** Constant-time comparison of the shared ingest key. */
export function keyMatches(given: string | null, expected: string | undefined): boolean {
  if (!given || !expected || given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

export type Derived = z.infer<typeof IngestTelemetry> & {
  device: string;
  ingest_ms: number;
  co2_in_ppm?: number;
  co2_out_ppm?: number;
  reduction_pct?: number;
  capture_g_min?: number;
  quality: "Good" | "Uncertain" | "Bad" | "Stale";
};

/** CO2 ppm from MQ-135 millivolts with each sensor's R0, reduction and capture rate, and the reading's quality. */
export function deriveTelemetry(row: z.infer<typeof IngestTelemetry>, now: number, cal: { in?: Mq135Cal; out?: Mq135Cal } = {}): Derived {
  const co2In = row.co2_in_mv !== undefined ? ppmFromMv(row.co2_in_mv, cal.in ?? DEFAULT_CAL) : null;
  const co2Out = row.co2_out_mv !== undefined ? ppmFromMv(row.co2_out_mv, cal.out ?? DEFAULT_CAL) : null;
  const both = co2In !== null && co2Out !== null;
  return {
    ...row,
    device: row.device ?? row.thing,
    ingest_ms: now,
    ...(co2In !== null && { co2_in_ppm: co2In }),
    ...(co2Out !== null && { co2_out_ppm: co2Out }),
    ...(both && { reduction_pct: +reductionPct(co2In, co2Out).toFixed(2) }),
    ...(both && row.gas_lpm !== undefined && { capture_g_min: +captureGPerMin(row.gas_lpm, co2In, co2Out).toFixed(5) }),
    quality: quality({ mv: Math.min(row.ambient_mv, row.exhaust_mv), sensorFault: row.sensor_fault, warmingUp: row.warming_up, buffered: row.buffered, updatedAt: now }, now),
  };
}
