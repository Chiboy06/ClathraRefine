// Chemical and signal calculations. Pure functions, tested in process.test.ts.

export const R_GAS = 8.314462618; // J/(mol·K)
export const M_CO2 = 0.04401; // kg/mol

/** Removal efficiency η = (C_in − C_out) / C_in × 100. */
export function removalEfficiency(cIn: number, cOut: number): number {
  if (cIn <= 0) return 0;
  return ((cIn - cOut) / cIn) * 100;
}

export type CaptureInputs = {
  pressurePa: number; // absolute column pressure
  flowM3h: number; // Q_gas
  tempK: number;
  yIn: number; // mole fraction, 0.112 for 11.2 % vol
  yOut: number;
};

// Demo inputs: 450 m3/h at 42.4 °C. The absorber pressure of 236.9 kPa(abs) is the value that
// reproduces the brief's 184.2 kg/h; at 1 atm the same inputs give 78.8 kg/h (see docs/ASSUMPTIONS.md).
export const DEMO_CAPTURE: CaptureInputs = {
  pressurePa: 236_917,
  flowM3h: 450,
  tempK: 315.55,
  yIn: 0.112,
  yOut: 0.009,
};

/** CO2 capture rate ṁ = (P × Q / (R × T)) × (y_in − y_out) × M_CO2, in kg/h. */
export function captureRateKgH(i: CaptureInputs): number {
  const molPerHour = (i.pressurePa * i.flowM3h) / (R_GAS * i.tempK);
  return molPerHour * (i.yIn - i.yOut) * M_CO2;
}

/** Guide 7.6: CO2 + 2OH⁻ → CO3²⁻ + H2O, so capacity to carbonate is NaOH molarity / 2 × 44.01 g per litre. */
export function solventCapacityGPerL(naohMolar = 0.025): number {
  return (naohMolar / 2) * M_CO2 * 1000;
}

/** Percentage of carbonate capacity used. */
export function solventLoadingPct(loadedG: number, solventL: number, naohMolar = 0.025): number {
  const cap = solventCapacityGPerL(naohMolar) * solventL;
  return cap > 0 ? Math.min(100, (loadedG / cap) * 100) : 0;
}

/** Guide 7.6 simulator, labelled simulated wherever shown. eff0 is an assumption, not a measurement. */
export function simulateCapture(minutes: number, opts = { inletPct: 1.0, gasLpm: 1.0, solventL: 2.0, eff0: 0.6 }) {
  const capacityG = solventCapacityGPerL() * opts.solventL;
  const co2InPerMin = opts.gasLpm * (opts.inletPct / 100) * 1.8;
  let loadedG = 0;
  const out: { min: number; outletPct: number; loadingPct: number }[] = [];
  for (let t = 0; t <= minutes; t++) {
    const eff = opts.eff0 * Math.max(0, 1 - loadedG / capacityG);
    loadedG += co2InPerMin * eff;
    out.push({ min: t, outletPct: +(opts.inletPct * (1 - eff)).toFixed(3), loadingPct: +((100 * loadedG) / capacityG).toFixed(1) });
  }
  return out;
}

// ---- Sensor scaling ----
// Rev A thresholds 1200/1500/2300 ADC became 1410/1770/2710 mV in the guide: a factor of about 1.178.
// shortcut: one linear factor from the guide's conversion, re-derive if the divider or attenuation changes.
export const MV_PER_ADC = 1.178;
export const adcToMv = (adc: number) => Math.round(adc * MV_PER_ADC);
export const mvToAdc = (mv: number) => Math.round(mv / MV_PER_ADC);

// Firmware thresholds, sensor-side millivolts (guide section 4)
export const FW = {
  EXH_ON_MV: 1770,
  EXH_OFF_MV: 1670,
  AMB_WARN_ON_MV: 1410,
  AMB_WARN_OFF_MV: 1310,
  AMB_CRIT_ON_MV: 2710,
  AMB_CRIT_OFF_MV: 2610,
  PUMP_STAGGER_MS: 2000,
  PURGE_HOLD_MS: 5000,
  WARMUP_MS: 180_000,
  CHECK_SENSOR_MV: 100,
} as const;

// Rev A ADC tiers shown on the escalation strip
export const ADC_TIERS = { warn: 1200, crit: 2300, max: 4095 } as const;

// ---- Units ----
export const pctToPpm = (pct: number) => Math.round(pct * 10_000);
export const ppmToPct = (ppm: number) => ppm / 10_000;

// ---- Bench capture panel (remodification brief section 5) ----
export const CO2_DENSITY_G_PER_L = 1.8; // near room temperature; adjustable

/** CO2 reduction % = (inlet − outlet) / inlet × 100. */
export const reductionPct = (inPpm: number, outPpm: number) => (inPpm > 0 ? ((inPpm - outPpm) / inPpm) * 100 : 0);

/** Capture rate in g/min = gas flow (L/min) × (inlet fraction − outlet fraction) × CO2 density (g/L). */
export const captureGPerMin = (gasLpm: number, inPpm: number, outPpm: number, density = CO2_DENSITY_G_PER_L) => Math.max(0, gasLpm * ((inPpm - outPpm) / 1e6) * density);
