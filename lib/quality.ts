import { FW } from "./process";

export type Quality = "Good" | "Uncertain" | "Bad" | "Stale";
export const STALE_MS = 10_000;

export type QualityInput = {
  mv?: number;
  sensorFault?: boolean;
  warmingUp?: boolean;
  buffered?: boolean;
  updatedAt: number; // client receipt time, epoch ms
};

/** Bad beats Stale beats Uncertain. A reading below 100 mV means "check sensor", not clean air. */
export function quality(q: QualityInput, now: number): Quality {
  if (q.sensorFault || (q.mv !== undefined && q.mv < FW.CHECK_SENSOR_MV)) return "Bad";
  if (now - q.updatedAt > STALE_MS) return "Stale";
  if (q.warmingUp || q.buffered) return "Uncertain";
  return "Good";
}
