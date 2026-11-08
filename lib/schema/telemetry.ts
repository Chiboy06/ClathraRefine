import { z } from "zod";

export const Level = z.enum(["NORMAL", "WARNING", "CRITICAL"]);
export const ScrubberState = z.enum(["IDLE", "INTAKE_ACTIVE", "SCRUBBING", "PURGING"]);

/** One board reading as stored by the TelemetryToStore rule. */
export const TelemetryRow = z.object({
  thing: z.string(),
  ts: z.coerce.number(),
  uptime_ms: z.coerce.number(),
  exhaust_mv: z.coerce.number(),
  ambient_mv: z.coerce.number(),
  ambient_level: Level,
  scrubber: ScrubberState,
  relay_mask: z.coerce.number().int().min(0).max(63),
  trip_latched: z.boolean(),
  siren_silenced: z.boolean(),
  warming_up: z.boolean(),
  scram: z.boolean(),
  sensor_fault: z.boolean(),
  buffered: z.boolean(),
  fw: z.string(),
  ingest_ms: z.coerce.number().optional(),
  // rev C firmware and optional sensors
  mode: z.enum(["AUTO", "MANUAL"]).optional(),
  co2_in_mv: z.coerce.number().optional(),
  co2_out_mv: z.coerce.number().optional(),
  gas_lpm: z.coerce.number().optional(),
  liquid_lpm: z.coerce.number().optional(),
  solvent_c: z.coerce.number().optional(),
  ph: z.coerce.number().optional(),
});
export type TelemetryRow = z.infer<typeof TelemetryRow>;

/** Command acknowledgement published on cmd/ack and stored by the AckToStore rule. */
export const AckRow = z.object({ cmd: z.string(), accepted: z.boolean(), reason: z.string().optional(), uptime_ms: z.coerce.number().optional(), ingest_ms: z.coerce.number() });
