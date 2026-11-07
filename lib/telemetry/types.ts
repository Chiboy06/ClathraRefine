import type { TelemetryRow } from "../schema/telemetry";

/** A board reading plus the time the client received it (for staleness). */
export type Sample = TelemetryRow & { receivedAt: number; check_sensor?: boolean };

export type SourceStatus = { connected: boolean; error?: string };

/** Every page reads board data through this interface. */
export interface TelemetrySource {
  readonly kind: "scenario" | "replay" | "api" | "stream";
  start(onSample: (s: Sample) => void, onStatus: (s: SourceStatus) => void): void;
  stop(): void;
}
