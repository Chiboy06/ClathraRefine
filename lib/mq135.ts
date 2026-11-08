// MQ-135 CO2 conversion. Sensor-side millivolts (after the 10k/15k divider correction on the board) to ppm.
// Tested in sensors.test.ts.

export type Mq135Cal = { rlKohm: number; vcMv: number; r0Kohm: number };

// Common MQ-135 CO2 curve: ppm = A × (Rs/R0)^B
export const MQ135_A = 116.6020682;
export const MQ135_B = -2.769034857;
export const FRESH_AIR_PPM = 420;
export const DEFAULT_CAL: Mq135Cal = { rlKohm: 10, vcMv: 5000, r0Kohm: 76.63 };

/** Sensor resistance from the module output: Rs = RL × (Vc − V) / V. */
export function rsFromMv(mv: number, cal: Pick<Mq135Cal, "rlKohm" | "vcMv"> = DEFAULT_CAL): number | null {
  if (!(mv > 0) || mv >= cal.vcMv) return null;
  return (cal.rlKohm * (cal.vcMv - mv)) / mv;
}

export const ppmFromRs = (rs: number, r0: number) => MQ135_A * Math.pow(rs / r0, MQ135_B);

/** R0 from the average Rs in fresh air, assuming 420 ppm outdoor CO2. */
export const r0FromFreshAir = (rsAvg: number, ppmAir = FRESH_AIR_PPM) => rsAvg / Math.pow(ppmAir / MQ135_A, 1 / MQ135_B);

export function ppmFromMv(mv: number, cal: Mq135Cal = DEFAULT_CAL): number | null {
  const rs = rsFromMv(mv, cal);
  return rs === null ? null : Math.round(ppmFromRs(rs, cal.r0Kohm));
}

/** Inverse, used by the DEMO scenario to produce realistic sensor millivolts for a target ppm. */
export function mvForPpm(ppm: number, cal: Mq135Cal = DEFAULT_CAL): number {
  const rs = cal.r0Kohm * Math.pow(ppm / MQ135_A, 1 / MQ135_B);
  return Math.round((cal.vcMv * cal.rlKohm) / (rs + cal.rlKohm));
}

/** Fresh-air calibration from 60 s of readings (mV). Returns R0 in kΩ, or null if the readings are unusable. */
export function calibrateR0(mvSamples: number[], cal: Pick<Mq135Cal, "rlKohm" | "vcMv"> = DEFAULT_CAL): number | null {
  const rs = mvSamples.map((m) => rsFromMv(m, cal)).filter((r): r is number => r !== null);
  if (rs.length < 10) return null;
  return r0FromFreshAir(rs.reduce((a, b) => a + b, 0) / rs.length);
}
