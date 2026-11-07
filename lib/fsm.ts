// TypeScript port of the rev B firmware safety and scrubber logic (guide section 4).
// Used by the DEMO scenario and by the replay check. It never actuates anything real.
import { FW } from "./process";

export type Level = "NORMAL" | "WARNING" | "CRITICAL";
export type Scrubber = "IDLE" | "INTAKE_ACTIVE" | "SCRUBBING" | "PURGING";

export type BoardState = {
  level: Level;
  scrubber: Scrubber;
  tripLatched: boolean;
  sirenSilenced: boolean;
  scram: boolean;
  sensorFault: boolean;
  warmingUp: boolean;
  gasActive: boolean;
  intakeStart: number;
  clearedAt: number;
  relayMask: number;
};

export type StepInput = {
  uptimeMs: number;
  exhaustMv: number;
  ambientMv: number;
  ackPressed?: boolean;
  scramRequest?: boolean;
  sensorFault?: boolean;
};

export const initialBoard = (): BoardState => ({
  level: "NORMAL",
  scrubber: "IDLE",
  tripLatched: false,
  sirenSilenced: false,
  scram: false,
  sensorFault: false,
  warmingUp: true,
  gasActive: false,
  intakeStart: 0,
  clearedAt: 0,
  relayMask: 0,
});

// bit 0 = relay 1 (fan) ... bit 5 = relay 6 (siren)
export const RELAY_BIT = { fan: 0, pump: 1, red: 2, green: 3, yellow: 4, siren: 5 } as const;
const setBit = (m: number, bit: number, on: boolean) => (on ? m | (1 << bit) : m & ~(1 << bit));
export const relayOn = (mask: number, relay: number) => ((mask >> (relay - 1)) & 1) === 1;

export function stepBoard(prev: BoardState, i: StepInput): BoardState {
  const s = { ...prev };
  const now = i.uptimeMs;
  s.warmingUp = now < FW.WARMUP_MS;
  s.sensorFault = !!i.sensorFault;
  let mask = s.relayMask;

  // ---- HazardSafety ----
  if (i.scramRequest) {
    s.scram = true;
    s.tripLatched = true;
    s.sirenSilenced = false;
  }
  if (!s.warmingUp) {
    const mv = i.ambientMv;
    if (s.level === "NORMAL") {
      if (mv >= FW.AMB_CRIT_ON_MV) s.level = "CRITICAL";
      else if (mv >= FW.AMB_WARN_ON_MV) s.level = "WARNING";
    } else if (s.level === "WARNING") {
      if (mv >= FW.AMB_CRIT_ON_MV) s.level = "CRITICAL";
      else if (mv <= FW.AMB_WARN_OFF_MV) s.level = "NORMAL";
    } else {
      if (mv <= FW.AMB_WARN_OFF_MV) s.level = "NORMAL";
      else if (mv <= FW.AMB_CRIT_OFF_MV) s.level = "WARNING";
    }
  }
  if (s.level === "CRITICAL" || s.sensorFault) {
    if (!s.tripLatched) s.sirenSilenced = false;
    s.tripLatched = true;
  }
  if (i.ackPressed && s.tripLatched) {
    if (s.level === "NORMAL" && !s.sensorFault) {
      s.tripLatched = false;
      s.scram = false;
      s.sirenSilenced = false;
    } else {
      s.sirenSilenced = true;
    }
  }
  if (s.tripLatched) {
    mask = setBit(mask, RELAY_BIT.green, false);
    mask = setBit(mask, RELAY_BIT.yellow, false);
    mask = setBit(mask, RELAY_BIT.red, true);
    mask = setBit(mask, RELAY_BIT.siren, !s.sirenSilenced);
  } else if (s.warmingUp || s.level === "WARNING") {
    mask = setBit(mask, RELAY_BIT.green, false);
    mask = setBit(mask, RELAY_BIT.red, false);
    mask = setBit(mask, RELAY_BIT.siren, false);
    mask = setBit(mask, RELAY_BIT.yellow, true);
  } else {
    mask = setBit(mask, RELAY_BIT.red, false);
    mask = setBit(mask, RELAY_BIT.yellow, false);
    mask = setBit(mask, RELAY_BIT.siren, false);
    mask = setBit(mask, RELAY_BIT.green, true);
  }

  // ---- ExhaustControl ----
  if (s.scram) {
    mask = setBit(mask, RELAY_BIT.pump, false);
    mask = setBit(mask, RELAY_BIT.fan, true);
    s.scrubber = "IDLE";
    s.gasActive = false;
  } else {
    if (!s.gasActive && i.exhaustMv >= FW.EXH_ON_MV) s.gasActive = true;
    else if (s.gasActive && i.exhaustMv <= FW.EXH_OFF_MV) s.gasActive = false;
    if (s.warmingUp) s.gasActive = false;
    switch (s.scrubber) {
      case "IDLE":
        if (prev.scram) mask = setBit(mask, RELAY_BIT.fan, false);
        if (s.gasActive) {
          mask = setBit(mask, RELAY_BIT.fan, true);
          mask = setBit(mask, RELAY_BIT.pump, false);
          s.intakeStart = now;
          s.scrubber = "INTAKE_ACTIVE";
        }
        break;
      case "INTAKE_ACTIVE":
        if (!s.gasActive) {
          s.clearedAt = now;
          s.scrubber = "PURGING";
        } else if (now - s.intakeStart >= FW.PUMP_STAGGER_MS) {
          mask = setBit(mask, RELAY_BIT.pump, true);
          s.scrubber = "SCRUBBING";
        }
        break;
      case "SCRUBBING":
        if (!s.gasActive) {
          s.clearedAt = now;
          s.scrubber = "PURGING";
        }
        break;
      case "PURGING":
        if (s.gasActive) {
          mask = setBit(mask, RELAY_BIT.fan, true);
          mask = setBit(mask, RELAY_BIT.pump, true);
          s.scrubber = "SCRUBBING";
        } else if (now - s.clearedAt >= FW.PURGE_HOLD_MS) {
          mask = setBit(mask, RELAY_BIT.pump, false);
          mask = setBit(mask, RELAY_BIT.fan, false);
          s.scrubber = "IDLE";
        }
        break;
    }
  }
  s.relayMask = mask;
  return s;
}
