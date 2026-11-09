import { api } from "../../convex/_generated/api";
import { convex } from "../convexClient";
import type { Sample, SourceStatus, TelemetrySource } from "./types";
import type { Ack } from "./hub";

const THING = "ESP32S3-N16R8-HARNESS-01";

/** LIVE through Convex: reactive queries push new readings and command acks, no polling. Needs Clerk sign-in. */
export class ConvexSource implements TelemetrySource {
  readonly kind = "stream" as const;
  private unsub: (() => void)[] = [];
  private lastIngest = 0;
  private lastAck = Date.now();
  constructor(private onAck: (a: Ack) => void) {}

  start(onSample: (s: Sample) => void, onStatus: (s: SourceStatus) => void) {
    if (!convex) return onStatus({ connected: false, error: "Convex is not configured" });
    const fail = (e: Error) => onStatus({ connected: false, error: /Sign in/.test(e.message) ? "Sign in with Clerk to read LIVE data" : e.message });
    const w = convex.watchQuery(api.telemetry.recent, { device: THING, limit: 150 });
    this.unsub.push(
      w.onUpdate(() => {
        try {
          for (const r of w.localQueryResult() ?? []) {
            if (r.ingest_ms <= this.lastIngest) continue;
            this.lastIngest = r.ingest_ms;
            onSample({ ...r, thing: r.device, receivedAt: r.ingest_ms, check_sensor: r.exhaust_mv < 100 || r.ambient_mv < 100 });
          }
          onStatus({ connected: true });
        } catch (e) {
          fail(e as Error);
        }
      }),
    );
    const ev = convex.watchQuery(api.telemetry.events, { device: THING, limit: 20 });
    this.unsub.push(
      ev.onUpdate(() => {
        try {
          for (const r of [...(ev.localQueryResult() ?? [])].reverse()) {
            if (r.kind !== "ack" || r.ingest_ms <= this.lastAck) continue;
            this.lastAck = r.ingest_ms;
            this.onAck({ cmd: r.cmd ?? "", accepted: !!r.accepted, reason: r.reason, at: r.ingest_ms });
          }
        } catch {
          // event errors surface through the telemetry watch
        }
      }),
    );
  }

  stop() {
    this.unsub.forEach((u) => u());
    this.unsub = [];
  }
}
