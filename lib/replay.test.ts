import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { ReplaySource } from "./telemetry/sources";
import type { Sample } from "./telemetry/types";
import { initialBoard, stepBoard } from "./fsm";

// Replay check: rows played through ReplaySource, re-derived by the firmware port from the recorded millivolts,
// must give the same alarm and scrubber timeline the board itself recorded.
// The ACK button and SCRAM are not in telemetry, so they are inferred from the recorded flags.
const key = (s: { ambient_level: string; scrubber: string; trip_latched: boolean; scram: boolean }) => `${s.ambient_level}|${s.scrubber}|${s.trip_latched}|${s.scram}`;

function timeline(keys: string[]) {
  return keys.filter((k, i) => i === 0 || k !== keys[i - 1]);
}

for (const file of readdirSync("fixtures/recordings").filter((f) => f.endsWith(".json"))) {
  describe(`replay ${file}`, () => {
    it("matches the firmware's own timeline", () => {
      vi.useFakeTimers();
      const rows = JSON.parse(readFileSync(`fixtures/recordings/${file}`, "utf8"));
      const got: Sample[] = [];
      const src = new ReplaySource(rows, 1);
      src.start((s) => got.push(s), () => {});
      vi.advanceTimersByTime(2000 * rows.length);
      src.stop();
      vi.useRealTimers();
      expect(got).toHaveLength(rows.length);

      let b = initialBoard();
      // Start from the recorded state so a recording that begins mid-session lines up.
      b = { ...b, level: got[0].ambient_level, scrubber: got[0].scrubber, tripLatched: got[0].trip_latched, scram: got[0].scram, relayMask: got[0].relay_mask };
      const derived: string[] = [];
      got.forEach((s, i) => {
        const prev = got[i - 1];
        const ackPressed = !!prev && ((prev.trip_latched && !s.trip_latched) || (!prev.siren_silenced && s.siren_silenced));
        const scramRequest = !!prev && !prev.scram && s.scram;
        if (i > 0) b = stepBoard(b, { uptimeMs: s.uptime_ms, exhaustMv: s.exhaust_mv, ambientMv: s.ambient_mv, ackPressed, scramRequest, sensorFault: s.sensor_fault });
        derived.push(key({ ambient_level: b.level, scrubber: b.scrubber, trip_latched: b.tripLatched, scram: b.scram }));
      });
      expect(timeline(derived)).toEqual(timeline(got.map(key)));
    });
  });
}
